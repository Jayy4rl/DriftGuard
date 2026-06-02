// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {MockGMX} from "./MockGMX.sol";

contract HedgeExecutor {
    IERC20 public immutable usdc;
    IERC4626 public immutable morphoVault;
    MockGMX public immutable gmxRouter;
    address public immutable automation; // RSC relay address on Base
    address public immutable vault; // DeltaVault — only caller of closeHedge
    address public immutable owner; // deployer — funds collateral

    int256 public currentShortSize; // net GMX position in ETH units (1e18)
    uint256 public lastHedgeTimestamp;
    uint256 public bufferUsdc; // raw USDC kept liquid, never deposited to Morpho

    uint256 public constant COOLDOWN = 60;
    uint256 public constant MIN_ADJUSTMENT_ETH = 0.01e18;

    event HedgeAdjusted(int256 sizeAdjustment, int256 newShortSize);
    event HedgeClosed(int256 finalSize);
    event BufferUpdated(uint256 newBuffer);

    error NotAutomation();
    error NotVault();
    error NotOwner();
    error CooldownActive();
    error AdjustmentTooSmall();

    modifier onlyAutomation() {
        if (msg.sender != automation) revert NotAutomation();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _usdc,
        address _morphoVault,
        address _gmxRouter,
        address _automation,
        address _vault,
        uint256 _bufferUsdc
    ) {
        usdc = IERC20(_usdc);
        morphoVault = IERC4626(_morphoVault);
        gmxRouter = MockGMX(_gmxRouter);
        automation = _automation;
        vault = _vault;
        owner = msg.sender;
        bufferUsdc = _bufferUsdc;
    }

    // Called by RSC relay with a fully-computed signed size adjustment in ETH units.
    // Positive = increase short (LP gained ETH exposure).
    // Negative = decrease short (LP lost ETH exposure).
    function adjustHedge(int256 sizeAdjustment) external onlyAutomation {
        if (block.timestamp < lastHedgeTimestamp + COOLDOWN) revert CooldownActive();

        uint256 absAdj = sizeAdjustment >= 0 ? uint256(sizeAdjustment) : uint256(-sizeAdjustment);
        if (absAdj < MIN_ADJUSTMENT_ETH) revert AdjustmentTooSmall();

        gmxRouter.createOrder(sizeAdjustment);
        currentShortSize += sizeAdjustment;
        lastHedgeTimestamp = block.timestamp;

        emit HedgeAdjusted(sizeAdjustment, currentShortSize);
    }

    // Called by DeltaVault on full withdrawal to close the hedge entirely.
    function closeHedge() external onlyVault {
        if (currentShortSize == 0) return;
        int256 finalSize = currentShortSize;
        gmxRouter.createOrder(-currentShortSize);
        currentShortSize = 0;
        emit HedgeClosed(finalSize);
    }

    // Owner deposits USDC as collateral. Anything above bufferUsdc goes into Morpho.
    function fundHedge(uint256 amount) external onlyOwner {
        usdc.transferFrom(msg.sender, address(this), amount);

        uint256 balance = usdc.balanceOf(address(this));
        if (balance > bufferUsdc) {
            uint256 toDeposit = balance - bufferUsdc;
            usdc.approve(address(morphoVault), toDeposit);
            morphoVault.deposit(toDeposit, address(this));
        }
    }

    // Owner withdraws from Morpho back to their wallet.
    function withdrawCollateral(uint256 amount) external onlyOwner {
        morphoVault.withdraw(amount, msg.sender, address(this));
    }

    // Owner adjusts the USDC buffer. Should be sized to cover at least one margin top-up.
    function setBuffer(uint256 newBuffer) external onlyOwner {
        bufferUsdc = newBuffer;
        emit BufferUpdated(newBuffer);
    }
}
