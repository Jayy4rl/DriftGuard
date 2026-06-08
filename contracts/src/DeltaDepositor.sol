// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeltaHook} from "./Vixa.sol";

// Minimal single-user LP depositor for the DeltaHook MVP.

contract DeltaDepositor is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using TransientStateLibrary for IPoolManager;
    using StateLibrary for IPoolManager;

    enum Action {
        DEPOSIT,
        WITHDRAW,
        REBALANCE
    }

    struct CallbackData {
        Action action;
        address payer; // token source/destination (the LP)
        PoolKey key;
        bytes32 positionId;
        uint128 halfLiquidity;
        int24 longLower;
        int24 longUpper;
        int24 shortLower;
        int24 shortUpper;
        uint256 deltaThreshold;
    }

    IPoolManager public immutable poolManager;
    DeltaHook public immutable hook;
    address public immutable depositorOwner; // single-user MVP

    error NotPoolManager();
    error NotAuthorized();

    constructor(IPoolManager _poolManager, DeltaHook _hook) {
        poolManager = _poolManager;
        hook = _hook;
        depositorOwner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != depositorOwner) revert NotAuthorized();
        _;
    }

    //  Public entry points 

    function deposit(PoolKey calldata key, uint128 liquidityAmount, uint256 deltaThreshold)
        external
        onlyOwner
        returns (bytes32 positionId)
    {
        require(liquidityAmount >= 2, "liquidity too small");
        require(deltaThreshold > 0, "threshold must be non-zero");

        (uint160 sqrtPriceX96, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        require(sqrtPriceX96 != 0, "pool not initialized");

        int24 rw = hook.RANGE_WIDTH();
        int24 ts = key.tickSpacing;
        require(rw % ts == 0, "RANGE_WIDTH not divisible by tickSpacing");

        int24 center = currentTick < 0 ? ((currentTick - ts + 1) / ts) * ts : (currentTick / ts) * ts;
        require(center - rw >= TickMath.minUsableTick(ts), "long leg below min tick");
        require(center + rw <= TickMath.maxUsableTick(ts), "short leg above max tick");

        // positionId is deterministic: same owner + same pool + same block = same id.
        // Both leg calls produce the same id so the hook accumulates them into one struct.
        positionId = keccak256(abi.encodePacked(msg.sender, key.toId(), block.number));
        require(hook.getPosition(positionId).owner == address(0), "deposit exists for this block");

        poolManager.unlock(
            abi.encode(
                CallbackData({
                    action: Action.DEPOSIT,
                    payer: msg.sender,
                    key: key,
                    positionId: positionId,
                    halfLiquidity: liquidityAmount / 2,
                    longLower: center - rw,
                    longUpper: center,
                    shortLower: center + ts,
                    shortUpper: center + rw,
                    deltaThreshold: deltaThreshold
                })
            )
        );
    }

    function withdraw(bytes32 positionId) external onlyOwner {
        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        require(pos.owner != address(0), "position does not exist");
        require(pos.owner == msg.sender, "not position owner");
        require(pos.longVolLiquidity > 0 && pos.shortVolLiquidity > 0, "position already being withdrawn");
        PoolKey memory key = hook.getPoolKey(positionId);
        require(Currency.unwrap(key.currency0) != address(0), "pool key not found");

        poolManager.unlock(
            abi.encode(
                CallbackData({
                    action: Action.WITHDRAW,
                    payer: msg.sender,
                    key: key,
                    positionId: positionId,
                    halfLiquidity: 0, // unused for withdraw
                    longLower: pos.longVolTickLower,
                    longUpper: pos.longVolTickUpper,
                    shortLower: pos.shortVolTickLower,
                    shortUpper: pos.shortVolTickUpper,
                    deltaThreshold: 0 // unused for withdraw
                })
            )
        );
    }

    // Called by RSC relay or owner when afterSwap detects a threshold breach.
    // Recomputes target ranges around current price and repositions both legs.
    function triggerRebalance(bytes32 positionId) external {
        if (msg.sender != depositorOwner && msg.sender != hook.rscRelay()) revert NotAuthorized();

        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        PoolKey memory key = hook.getPoolKey(positionId);

        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        int24 rw = hook.RANGE_WIDTH();
        int24 ts = key.tickSpacing;
        int24 center = currentTick < 0 ? ((currentTick - ts + 1) / ts) * ts : (currentTick / ts) * ts;

        poolManager.unlock(
            abi.encode(
                CallbackData({
                    action: Action.REBALANCE,
                    payer: depositorOwner,
                    key: key,
                    positionId: positionId,
                    halfLiquidity: 0, // liquidity read from pos inside callback
                    longLower: center - rw, // new target ranges
                    longUpper: center,
                    shortLower: center + ts,
                    shortUpper: center + rw,
                    deltaThreshold: pos.deltaThreshold // preserve threshold so hook state stays correct
                })
            )
        );
    }

    //  Unlock callback 

    function unlockCallback(bytes calldata rawData) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        CallbackData memory d = abi.decode(rawData, (CallbackData));

        if (d.action == Action.DEPOSIT) _handleDeposit(d);
        else if (d.action == Action.WITHDRAW) _handleWithdraw(d);
        else _handleRebalance(d);

        return "";
    }

    //  Internal handlers 

    function _handleDeposit(CallbackData memory d) internal {
        // Long-vol leg (leg 0) — range below current price
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: d.longLower,
                tickUpper: d.longUpper,
                liquidityDelta: int256(uint256(d.halfLiquidity)),
                salt: bytes32(0)
            }),
            abi.encode(d.positionId, d.payer, d.deltaThreshold, uint8(0))
        );

        // Short-vol leg (leg 1) — range above current price
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: d.shortLower,
                tickUpper: d.shortUpper,
                liquidityDelta: int256(uint256(d.halfLiquidity)),
                salt: bytes32(uint256(1))
            }),
            abi.encode(d.positionId, d.payer, d.deltaThreshold, uint8(1))
        );

        // Settle: pull tokens from payer to cover the PoolManager's negative delta
        _settle(d.key.currency0, d.payer);
        _settle(d.key.currency1, d.payer);
    }

    function _handleWithdraw(CallbackData memory d) internal {
        DeltaHook.SubPositionState memory pos = hook.getPosition(d.positionId);
        uint256 nonce = hook.stateNonce(d.positionId);

        // First leg (isLastLeg = false): hook zeroes the removed leg's liquidity.
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: d.longLower,
                tickUpper: d.longUpper,
                liquidityDelta: -int256(uint256(pos.longVolLiquidity)),
                salt: bytes32(0)
            }),
            abi.encode(d.positionId, nonce, false)
        );

        // Second leg (isLastLeg = true): hook deletes the position and emits PositionClosed.
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: d.shortLower,
                tickUpper: d.shortUpper,
                liquidityDelta: -int256(uint256(pos.shortVolLiquidity)),
                salt: bytes32(uint256(1))
            }),
            abi.encode(d.positionId, nonce, true)
        );

        // Send redeemed tokens back to the LP
        _take(d.key.currency0, d.payer);
        _take(d.key.currency1, d.payer);
    }

    function _handleRebalance(CallbackData memory d) internal {
        DeltaHook.SubPositionState memory pos = hook.getPosition(d.positionId);

        // Remove from old ranges
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: pos.longVolTickLower,
                tickUpper: pos.longVolTickUpper,
                liquidityDelta: -int256(uint256(pos.longVolLiquidity)),
                salt: bytes32(0)
            }),
            ""
        );
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: pos.shortVolTickLower,
                tickUpper: pos.shortVolTickUpper,
                liquidityDelta: -int256(uint256(pos.shortVolLiquidity)),
                salt: bytes32(uint256(1))
            }),
            ""
        );

        // Add to new ranges — pass deposit-format hookData so the hook updates SubPositionState.
        // Without this, the hook's stored tick ranges and sqrtPrice bounds go stale after rebalance,
        // causing wrong delta reads in afterSwap and a revert on the next rebalance attempt.
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: d.longLower,
                tickUpper: d.longUpper,
                liquidityDelta: int256(uint256(pos.longVolLiquidity)),
                salt: bytes32(0)
            }),
            abi.encode(d.positionId, pos.owner, d.deltaThreshold, uint8(0))
        );
        poolManager.modifyLiquidity(
            d.key,
            ModifyLiquidityParams({
                tickLower: d.shortLower,
                tickUpper: d.shortUpper,
                liquidityDelta: int256(uint256(pos.shortVolLiquidity)),
                salt: bytes32(uint256(1))
            }),
            abi.encode(d.positionId, pos.owner, d.deltaThreshold, uint8(1))
        );

        // Settle net token delta after remove + re-add.
       
        _settle(d.key.currency0, d.payer);
        _settle(d.key.currency1, d.payer);
        _take(d.key.currency0, d.payer);
        _take(d.key.currency1, d.payer);
    }

    //  Settlement helpers 

    // Pay tokens we owe the pool (negative delta = we owe).
    function _settle(Currency currency, address payer) internal {
        int256 delta = poolManager.currencyDelta(address(this), currency);
        if (delta >= 0) return;
        uint256 amount = uint256(-delta);
        poolManager.sync(currency);
        IERC20(Currency.unwrap(currency)).transferFrom(payer, address(poolManager), amount);
        poolManager.settle();
    }

    // Collect tokens the pool owes us (positive delta = pool owes us).
    function _take(Currency currency, address recipient) internal {
        int256 delta = poolManager.currencyDelta(address(this), currency);
        if (delta <= 0) return;
        poolManager.take(currency, recipient, uint256(delta));
    }
}
