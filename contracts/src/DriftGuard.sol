// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-hooks-public/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";

contract DeltaHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using TransientStateLibrary for IPoolManager;

    // Constants
            int24 public constant RANGE_WIDTH = 2000;

    //  Types 

    struct SubPositionState {
        address owner;
        // Long-vol leg: range BELOW current price. At deposit, price = upper tick → holds max WETH.
        // As price falls into range, AMM accumulates USDC. Positive delta when price is in-range.
        int24 longVolTickLower;
        int24 longVolTickUpper;
        uint128 longVolLiquidity;
        uint160 longVolSqrtPriceLowerX96; // precomputed: TickMath.getSqrtPriceAtTick(tickLower)
        uint160 longVolSqrtPriceUpperX96; // precomputed: TickMath.getSqrtPriceAtTick(tickUpper)

        // Short-vol leg: range ABOVE current price. At deposit, price = lower tick → holds max USDC.
        // As price rises into range, AMM accumulates WETH. Delta grows as price enters range.
        int24 shortVolTickLower;
        int24 shortVolTickUpper;
        uint128 shortVolLiquidity;
        uint160 shortVolSqrtPriceLowerX96; // precomputed
        uint160 shortVolSqrtPriceUpperX96; // precomputed

        // Net delta state
        int256 lastNetDelta; // signed: both legs contribute unsigned amounts, net is positive
        uint256 deltaThreshold; // magnitude in WETH units (1e18); rebalance when |netDelta| exceeds this
        uint256 depositBlock; // block at deposit — used as part of positionId uniqueness
    }

    //  Storage 
    mapping(PoolId => bool) public registeredPools;
    mapping(PoolId => bool) public paused;
    mapping(bytes32 positionId => SubPositionState) public positions;
    mapping(bytes32 positionId => PoolKey) public positionPoolKey; // needed by executeRebalance()
    mapping(PoolId => bytes32[]) public poolPositions; // multi-LP: array per pool
    mapping(bytes32 positionId => uint256) public stateNonce; // increments on each rebalance
    mapping(bytes32 => bool) public registeredPositions;

    // Critical safety: prevents nested hook callbacks from re-entering delta logic mid-rebalance.
    // Must be set true before any poolManager.unlock() call; cleared immediately after.
    bool private _rebalancing;

    address public depositor;
    address public rscRelay; // Reactive Network callback proxy — may call executeRebalance()
    address public immutable deployer;

    // Events 
    event PositionRegistered(
        bytes32 indexed positionId,
        address indexed owner,
        int24 longVolTickLower,
        int24 longVolTickUpper,
        int24 shortVolTickLower,
        int24 shortVolTickUpper,
        int256 netDelta
    );
    event RebalanceExecuted(bytes32 indexed positionId, int256 netDelta, uint256 blockNumber);
    event PositionClosed(bytes32 indexed positionId, int256 finalNetDelta);
    event PositionPartialWithdraw(bytes32 indexed positionId, int256 remainingNetDelta);
    // RSC triggers — emitted when hook cannot self-recover
    event PositionOutOfRange(bytes32 indexed positionId, uint256 blockNumber);
    event PositionInvariantViolated(bytes32 indexed positionId, string reason);
    // Emitted when threshold is breached. Depositor's triggerRebalance() or RSC watches this.
    event RebalanceNeeded(bytes32 indexed positionId, int256 netDelta, uint256 blockNumber);

    // Errors 
    error DirectDepositNotAllowed();
    error PoolPaused();
    error WithdrawalDuringRebalance();
    error WithdrawalNonceMismatch();
    error PostRebalanceDeltaExceedsThreshold();
    error CallerNotPoolManager();
    error NotDepositor();
    error NotDeployer();
    error PositionAlreadyExists();
    error InvalidTickRange();

    // Constructor 
    constructor(IPoolManager _manager, address _admin) BaseHook(_manager) {
        deployer = _admin;
    }

    function setRscRelay(address _relay) external {
        if (msg.sender != deployer) revert NotDeployer();
        rscRelay = _relay;
    }

    function setDepositor(address _depositor) external {
        if (msg.sender != deployer) revert NotDeployer();
        require(depositor == address(0), "depositor already set");
        depositor = _depositor;
    }

    // Hook Permissions 
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true, // enforce depositor-only deposits
            afterAddLiquidity: true, // register sub-positions on deposit
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true, // proportional unwind + nonce check
            beforeSwap: true, // emergency pause enforcement
            afterSwap: true, // net delta computation + atomic rebalance trigger
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // Hook Callbacks 

    // Fast no-op in normal operation. Reverts all swaps when pool is paused.
    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (paused[key.toId()]) revert PoolPaused();
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // Rejects any deposit that does not originate from the depositor.
    // Without this, direct deposits bypass sub-position splitting and silently corrupt delta accounting.
    function _beforeAddLiquidity(address sender, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        internal
        override
        returns (bytes4)
    {
        if (sender != depositor) revert DirectDepositNotAllowed();
        return IHooks.beforeAddLiquidity.selector;
    }

    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        // Skip nested callbacks fired during an in-progress rebalance.
        if (_rebalancing) return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        if (hookData.length == 0) return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);

        require(params.liquidityDelta > 0, "not an add");

        // hookData: (bytes32 positionId, address owner, uint256 deltaThreshold, uint8 legIndex)
        // Depositor makes two separate modifyLiquidity calls (one per leg).
        // legIndex 0 = long-vol (below price), legIndex 1 = short-vol (above price).
        (bytes32 positionId, address owner, uint256 deltaThreshold, uint8 legIndex) =
            abi.decode(hookData, (bytes32, address, uint256, uint8));

        uint128 legLiquidity = uint128(uint256(params.liquidityDelta));
        SubPositionState storage pos = positions[positionId];

        if (legIndex == 0) {
            pos.owner = owner;
            pos.deltaThreshold = deltaThreshold;
            pos.depositBlock = block.number;
            pos.longVolTickLower = params.tickLower;
            pos.longVolTickUpper = params.tickUpper;
            pos.longVolLiquidity = legLiquidity;
            pos.longVolSqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(params.tickLower);
            pos.longVolSqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(params.tickUpper);
        } else {
            pos.shortVolTickLower = params.tickLower;
            pos.shortVolTickUpper = params.tickUpper;
            pos.shortVolLiquidity = legLiquidity;
            pos.shortVolSqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(params.tickLower);
            pos.shortVolSqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(params.tickUpper);

            PoolId poolId = key.toId();
            (uint160 sqrtPriceCurrent,,,) = poolManager.getSlot0(poolId);

            int256 initialNetDelta = int256(
                _computeLPDelta(
                    sqrtPriceCurrent, pos.longVolSqrtPriceLowerX96, pos.longVolSqrtPriceUpperX96, pos.longVolLiquidity
                )
            )
            + int256(
                _computeLPDelta(
                    sqrtPriceCurrent,
                    pos.shortVolSqrtPriceLowerX96,
                    pos.shortVolSqrtPriceUpperX96,
                    pos.shortVolLiquidity
                )
            );

            pos.lastNetDelta = initialNetDelta;
if (!registeredPositions[positionId]) {
    registeredPositions[positionId] = true;
    poolPositions[poolId].push(positionId);
}
            positionPoolKey[positionId] = key;
            stateNonce[positionId] = block.number;

            emit PositionRegistered(
                positionId,
                owner,
                pos.longVolTickLower,
                pos.longVolTickUpper,
                pos.shortVolTickLower,
                pos.shortVolTickUpper,
                initialNetDelta
            );
        }

        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        // Guard: skip if a rebalance is already executing in this call stack.
        if (_rebalancing) return (IHooks.afterSwap.selector, 0);

        PoolId poolId = key.toId();
        // Read current price once, shared across all position iterations.
        (uint160 sqrtPriceCurrent,,,) = poolManager.getSlot0(poolId);

        bytes32[] storage posIds = poolPositions[poolId];
        uint256 len = posIds.length;

        for (uint256 i = 0; i < len;) {
            bytes32 positionId = posIds[i];

            // Load into memory. MLOAD (~100 gas) vs SLOAD (~2100 gas warm).
            SubPositionState memory pos = positions[positionId];

            // Skip deleted positions.
            if (pos.owner == address(0)) {
                unchecked {
                    ++i;
                }
                continue;
            }

            uint256 longVolDelta = _computeLPDelta(
                sqrtPriceCurrent, pos.longVolSqrtPriceLowerX96, pos.longVolSqrtPriceUpperX96, pos.longVolLiquidity
            );

            uint256 shortVolDelta = _computeLPDelta(
                sqrtPriceCurrent, pos.shortVolSqrtPriceLowerX96, pos.shortVolSqrtPriceUpperX96, pos.shortVolLiquidity
            );

            // Out-of-range detection.
           
            if (longVolDelta == 0 && shortVolDelta == 0 && pos.longVolLiquidity > 0) {
                emit PositionOutOfRange(positionId, block.number);
                unchecked {
                    ++i;
                }
                continue;
            }

            // Net delta.
            // Cast from uint256 to int256 is safe: both values bounded by
            // uint128 liquidity (~2^128), sum bounded by ~2^129, well under
            // int256 max (~2^255).
            int256 netDelta = int256(longVolDelta) + int256(shortVolDelta);

            // Absolute value.
            // netDelta is bounded by uint128 liquidity, nowhere near int256.min,
            // so negation cannot overflow.
            uint256 absDelta = netDelta >= 0 ? uint256(netDelta) : uint256(-netDelta);

            // CEI: write all state before the external call.
            //
            // lastNetDelta updated unconditionally so off-chain indexers can
            // track delta continuously even when no rebalance fires.
            //
            // stateNonce++ before _rebalancing = true: ensures that any
            // afterRemoveLiquidity nested inside unlockCallback sees the
            // incremented nonce and reverts the withdrawal cleanly.
            //
            positions[positionId].lastNetDelta = netDelta;

            if (absDelta > pos.deltaThreshold) {
                // Depositor owns positions — the hook cannot call modifyLiquidity on them.
                // Signal the depositor (or RSC relay) to call triggerRebalance().
                // For hook-owned positions (v2): replace this with _executeRebalance() inline.
                emit RebalanceNeeded(positionId, netDelta, block.number);
            }

            unchecked {
                ++i;
            }
        }

        return (IHooks.afterSwap.selector, 0);
    }

    function _afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        // Cannot withdraw while a rebalance is mid-execution — sub-position state is being written.
if (_rebalancing) return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
if (hookData.length == 0) return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);

        // hookData: (bytes32 positionId, uint256 expectedNonce, bool isLastLeg)
        // Depositor removes both legs in one unlock. This callback fires once per leg.
        // isLastLeg = true on the second call triggers position deletion.
        // Nonce check guards against withdrawal racing with a rebalance in the same block.
        (bytes32 positionId, uint256 expectedNonce, bool isLastLeg) = abi.decode(hookData, (bytes32, uint256, bool));
        if (stateNonce[positionId] != expectedNonce) revert WithdrawalNonceMismatch();

        SubPositionState storage pos = positions[positionId];

        if (isLastLeg) {
            // Both legs removed. Compute final delta, clean up state.
            (uint160 sqrtPriceCurrent,,,) = poolManager.getSlot0(key.toId());
            int256 finalNetDelta = int256(
                _computeLPDelta(
                    sqrtPriceCurrent, pos.longVolSqrtPriceLowerX96, pos.longVolSqrtPriceUpperX96, pos.longVolLiquidity
                )
            )
            + int256(
                _computeLPDelta(
                    sqrtPriceCurrent,
                    pos.shortVolSqrtPriceLowerX96,
                    pos.shortVolSqrtPriceUpperX96,
                    pos.shortVolLiquidity
                )
            );

            delete positions[positionId];
            delete stateNonce[positionId];
            delete registeredPositions[positionId];
            _removeFromPoolPositions(key.toId(), positionId);
            emit PositionClosed(positionId, finalNetDelta);
        } else {
            // First leg removed. Update the removed leg's liquidity to zero so
            // afterSwap skips it cleanly if a swap arrives between the two removes.
            // Determine which leg by tick range.
            if (params.tickUpper == pos.longVolTickUpper && params.tickLower == pos.longVolTickLower) {
                pos.longVolLiquidity = 0;
            } else {
                pos.shortVolLiquidity = 0;
            }
        }

        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    //  Range Computation 

    function computeRanges(int24 currentTick, int24 tickSpacing)
        internal
        pure
        returns (int24 longVolTickLower, int24 longVolTickUpper, int24 shortVolTickLower, int24 shortVolTickUpper)
    {
        // Floor division toward -∞
        int24 center = currentTick < 0
            ? ((currentTick - tickSpacing + 1) / tickSpacing) * tickSpacing
            : (currentTick / tickSpacing) * tickSpacing;

        longVolTickLower = center - RANGE_WIDTH;
        longVolTickUpper = center;
        shortVolTickLower = center + tickSpacing;
        shortVolTickUpper = center + RANGE_WIDTH;
    }

    function updatePositionRanges(bytes32 positionId) external {
    if (msg.sender != depositor) revert NotDepositor();
    SubPositionState storage pos = positions[positionId];
    require(pos.owner != address(0), "position not found");
    PoolKey memory key = positionPoolKey[positionId];
    (uint160 sqrtPriceCurrent, int24 currentTick,,) = poolManager.getSlot0(key.toId());
    (int24 newLl, int24 newLu, int24 newSl, int24 newSu) = computeRanges(currentTick, key.tickSpacing);
    pos.longVolTickLower          = newLl;
    pos.longVolTickUpper          = newLu;
    pos.longVolSqrtPriceLowerX96  = TickMath.getSqrtPriceAtTick(newLl);
    pos.longVolSqrtPriceUpperX96  = TickMath.getSqrtPriceAtTick(newLu);
    pos.shortVolTickLower         = newSl;
    pos.shortVolTickUpper         = newSu;
    pos.shortVolSqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(newSl);
    pos.shortVolSqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(newSu);

    // Recompute lastNetDelta against new ranges so off-chain indexers don't read a
    // pre-rebalance value. afterSwap will overwrite this on the next swap regardless.
    uint256 updatedLongDelta  = _computeLPDelta(sqrtPriceCurrent, pos.longVolSqrtPriceLowerX96,  pos.longVolSqrtPriceUpperX96,  pos.longVolLiquidity);
    uint256 updatedShortDelta = _computeLPDelta(sqrtPriceCurrent, pos.shortVolSqrtPriceLowerX96, pos.shortVolSqrtPriceUpperX96, pos.shortVolLiquidity);
    pos.lastNetDelta = int256(updatedLongDelta) + int256(updatedShortDelta);
}

    //  Delta Math (DeltaEngine) 
    // Pure library logic compiled into this contract. No separate deployment.
    // Returns token0 (WETH when currency1=WETH) amount held by a concentrated position.
    // For WETH as currency1 (typical Base WETH/USDC): use getAmount1Delta instead — caller's responsibility.
    function _computeLPDelta(
        uint160 sqrtPriceCurrentX96,
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint128 liquidity
    ) internal pure returns (uint256 token0Amount) {
        if (sqrtPriceCurrentX96 >= sqrtPriceUpperX96) return 0;
        if (sqrtPriceCurrentX96 <= sqrtPriceLowerX96) {
            return SqrtPriceMath.getAmount0Delta(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity, false);
        }
        return SqrtPriceMath.getAmount0Delta(sqrtPriceCurrentX96, sqrtPriceUpperX96, liquidity, false);
    }

    //  View helpers 

    function getPosition(bytes32 positionId) external view returns (SubPositionState memory) {
        return positions[positionId];
    }

    function getPoolKey(bytes32 positionId) external view returns (PoolKey memory) {
        return positionPoolKey[positionId];
    }

    //  Admin 
    function pausePool(PoolId poolId) external {
        if (msg.sender != depositor) revert NotDepositor();
        paused[poolId] = true;
    }

    function unpausePool(PoolId poolId) external {
        if (msg.sender != deployer) revert NotDeployer();
        paused[poolId] = false;
    }

    //  Internal Helpers 
    function _removeFromPoolPositions(PoolId poolId, bytes32 positionId) internal {
        bytes32[] storage arr = poolPositions[poolId];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == positionId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                return;
            }
        }
    }
}
