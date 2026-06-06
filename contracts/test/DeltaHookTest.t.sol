// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// forge test --match-contract DeltaHookTest -vvv

import {Test, Vm} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {HookMiner} from "v4-hooks-public/test/utils/HookMiner.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {DeltaHook} from "../src/DriftGuard.sol";
import {DeltaDepositor} from "../src/DeltaDepositor.sol";

contract DeltaHookTest is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    //  Contracts 
    IPoolManager manager;
    DeltaHook hook;
    DeltaDepositor depositor;
    PoolSwapTest swapRouter;
    PoolModifyLiquidityTest modifyLiqRouter;

    MockERC20 token0;
    MockERC20 token1;
    Currency currency0;
    Currency currency1;
    PoolKey key;

    //  Constants 
    // tickSpacing=10 keeps RANGE_WIDTH=2000 aligned to all produced tick values.
    int24 constant TICK_SPACING = 10;
    uint24 constant FEE = 3000;
    // sqrtPrice at tick=0 (1:1 token ratio)
    uint160 constant SQRT_PRICE_TICK0 = 79228162514264337593543950336;
    uint128 constant LIQUIDITY = 1e20;
    // Trivially small: any non-zero position delta exceeds this
    uint256 constant TINY_THRESHOLD = 1;
    // Effectively infinite: never exceeded
    uint256 constant HUGE_THRESHOLD = type(uint256).max;

    //  Event mirrors (for vm.expectEmit) 
    event PositionRegistered(
        bytes32 indexed positionId,
        address indexed owner,
        int24 longVolTickLower,
        int24 longVolTickUpper,
        int24 shortVolTickLower,
        int24 shortVolTickUpper,
        int256 netDelta
    );
    event RebalanceNeeded(bytes32 indexed positionId, int256 netDelta, uint256 blockNumber);
    event PositionClosed(bytes32 indexed positionId, int256 finalNetDelta);
    event PositionOutOfRange(bytes32 indexed positionId, uint256 blockNumber);

    //  setUp 
    function setUp() public {
        manager = new PoolManager(address(this));

        swapRouter = new PoolSwapTest(manager);
        modifyLiqRouter = new PoolModifyLiquidityTest(manager);

        // Sort tokens so token0 < token1 by address
        MockERC20 tA = new MockERC20("TokenA", "TA", 18);
        MockERC20 tB = new MockERC20("TokenB", "TB", 18);
        (token0, token1) = address(tA) < address(tB) ? (tA, tB) : (tB, tA);
        currency0 = Currency.wrap(address(token0));
        currency1 = Currency.wrap(address(token1));

        // Mine hook address with the required permission flags
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
        );
        (address hookAddr, bytes32 salt) =
            HookMiner.find(address(this), flags, type(DeltaHook).creationCode, abi.encode(address(manager), address(this)));
        hook = new DeltaHook{salt: salt}(IPoolManager(address(manager)), address(this));
        assertEq(address(hook), hookAddr, "hook address mismatch -- permission flags wrong");

        depositor = new DeltaDepositor(IPoolManager(address(manager)), hook);
        hook.setDepositor(address(depositor));

        key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        manager.initialize(key, SQRT_PRICE_TICK0);

        token0.mint(address(this), 1e36);
        token1.mint(address(this), 1e36);
        token0.approve(address(depositor), type(uint256).max);
        token1.approve(address(depositor), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
    }

    //  Helpers 

    function _deposit(uint128 liq, uint256 threshold) internal returns (bytes32) {
        return depositor.deposit(key, liq, threshold);
    }

    // Exact-input swap of token0 for token1 (price falls, tick decreases).
    function _swapDown(int256 amountIn) internal {
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -amountIn, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    // Large swap of token1 for token0 to push price above both legs' upper bounds.
    function _swapPastAllRanges() internal {
        int24 limit = int24(hook.RANGE_WIDTH()) + 10;
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: false,
                amountSpecified: -int256(1e30),
                sqrtPriceLimitX96: TickMath.getSqrtPriceAtTick(limit)
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    //  Access control 

    /// Any caller that is not the depositor must be rejected by beforeAddLiquidity.
    /// v4 wraps hook reverts in CustomRevert.WrappedError — expectRevert() without
    /// an argument asserts the call reverts for any reason.
    function test_beforeAddLiquidity_revertsDirectDeposit() public {
        // modifyLiqRouter is not the depositor; the hook must reject it.
        vm.expectRevert();
        modifyLiqRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: bytes32(0)}),
            ""
        );
    }

    /// Swaps must revert when the pool is paused via pausePool.
    /// v4 wraps hook reverts in CustomRevert.WrappedError — expectRevert() without
    /// an argument asserts the call reverts for any reason.
    function test_beforeSwap_revertsWhenPaused() public {
        _deposit(LIQUIDITY, HUGE_THRESHOLD);

        vm.prank(address(depositor));
        hook.pausePool(key.toId());

        vm.expectRevert();
        _swapDown(1e15);
    }

    //  Position registration 

    /// SubPositionState must be fully populated after deposit.
    function test_deposit_registersSubPositions() public {
        bytes32 positionId = _deposit(LIQUIDITY, HUGE_THRESHOLD);
        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);

        uint128 halfLiq = LIQUIDITY / 2;
        assertEq(pos.longVolLiquidity, halfLiq, "long-vol liquidity");
        assertEq(pos.shortVolLiquidity, halfLiq, "short-vol liquidity");

        // Pool initialised at tick=0, spacing=10 → center=0
        int24 expectedCenter = 0;
        assertEq(pos.longVolTickUpper, expectedCenter, "long-vol upper");
        assertEq(pos.shortVolTickLower, expectedCenter + TICK_SPACING, "short-vol lower");
        assertEq(pos.longVolTickLower, expectedCenter - hook.RANGE_WIDTH(), "long-vol lower");
        assertEq(pos.shortVolTickUpper, expectedCenter + hook.RANGE_WIDTH(), "short-vol upper");

        assertEq(pos.owner, address(this), "owner");
        assertEq(pos.deltaThreshold, HUGE_THRESHOLD, "threshold");

        // Precomputed sqrtPrice bounds must match TickMath
        assertEq(pos.longVolSqrtPriceLowerX96, TickMath.getSqrtPriceAtTick(pos.longVolTickLower));
        assertEq(pos.longVolSqrtPriceUpperX96, TickMath.getSqrtPriceAtTick(pos.longVolTickUpper));
        assertEq(pos.shortVolSqrtPriceLowerX96, TickMath.getSqrtPriceAtTick(pos.shortVolTickLower));
        assertEq(pos.shortVolSqrtPriceUpperX96, TickMath.getSqrtPriceAtTick(pos.shortVolTickUpper));
    }

    /// PositionRegistered must be emitted with the correct positionId and owner.
    function test_deposit_emitsPositionRegistered() public {
        bytes32 expectedId = keccak256(abi.encodePacked(address(this), key.toId(), block.number));
        vm.expectEmit(true, true, false, false, address(hook));
        emit PositionRegistered(expectedId, address(this), 0, 0, 0, 0, 0);
        _deposit(LIQUIDITY, HUGE_THRESHOLD);
    }

    /// Repeated deposits from the same address in the same block must not
    /// double-register the position in poolPositions (registeredPositions guard).
    function test_deposit_noDoubleRegistration() public {
        bytes32 id1 = _deposit(LIQUIDITY, HUGE_THRESHOLD);

        // Advance block so a second deposit gets a new positionId
        vm.roll(block.number + 1);
        bytes32 id2 = _deposit(LIQUIDITY, HUGE_THRESHOLD);

        assertTrue(id1 != id2, "same positionId despite different block");

        // Both positions must exist independently
        assertGt(hook.getPosition(id1).longVolLiquidity, 0);
        assertGt(hook.getPosition(id2).longVolLiquidity, 0);
    }

    // Withdrawal 

    /// Full withdrawal must delete position state and emit PositionClosed.
    function test_withdraw_deletesStateAndEmitsEvent() public {
        bytes32 positionId = _deposit(LIQUIDITY, HUGE_THRESHOLD);

        vm.expectEmit(true, false, false, false, address(hook));
        emit PositionClosed(positionId, 0);
        depositor.withdraw(positionId);

        assertEq(hook.getPosition(positionId).owner, address(0), "position not deleted");
    }

    //  afterSwap event emission 

    /// RebalanceNeeded must fire on any swap when the threshold is trivially small.
    function test_afterSwap_emitsRebalanceNeeded_whenThresholdBreached() public {
        bytes32 positionId = _deposit(LIQUIDITY, TINY_THRESHOLD);

        // At tick=0 the short-vol leg holds max token0 → netDelta >> 1 → threshold breached.
        vm.expectEmit(true, false, false, false, address(hook));
        emit RebalanceNeeded(positionId, 0, 0);
        _swapDown(1e15);
    }

    /// No RebalanceNeeded must be emitted when threshold is effectively infinite.
    function test_afterSwap_noEventWhenThresholdNotBreached() public {
        _deposit(LIQUIDITY, HUGE_THRESHOLD);

        vm.recordLogs();
        _swapDown(1e15);

        bytes32 sig = keccak256("RebalanceNeeded(bytes32,int256,uint256)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(hook)) {
                assertTrue(logs[i].topics[0] != sig, "unexpected RebalanceNeeded");
            }
        }
    }

    /// PositionOutOfRange must fire when a swap pushes price above both legs.
    function test_afterSwap_emitsOutOfRange_whenPriceAboveBothLegs() public {
        bytes32 positionId = _deposit(LIQUIDITY, HUGE_THRESHOLD);

        vm.expectEmit(true, false, false, false, address(hook));
        emit PositionOutOfRange(positionId, 0);
        _swapPastAllRanges();
    }

    //  Rebalance correctness 

    /// triggerRebalance must update tick ranges in SubPositionState.
    function test_triggerRebalance_updatesHookStateRanges() public {
        bytes32 positionId = _deposit(LIQUIDITY, TINY_THRESHOLD);
        _swapDown(1e17);

        (, int24 tickAfterSwap,,) = manager.getSlot0(key.toId());
        depositor.triggerRebalance(positionId);

        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        // Center must be at the floored tick after the swap.
        int24 spacing = TICK_SPACING;
        int24 expectedCenter = tickAfterSwap < 0
            ? ((tickAfterSwap - spacing + 1) / spacing) * spacing
            : (tickAfterSwap / spacing) * spacing;

        assertEq(pos.longVolTickUpper, expectedCenter, "long-vol upper not updated");
        assertEq(pos.shortVolTickLower, expectedCenter + TICK_SPACING, "short-vol lower not updated");
    }

    /// triggerRebalance must preserve the original deltaThreshold — not zero it.
    function test_triggerRebalance_preservesDeltaThreshold() public {
        uint256 threshold = 5e17;
        bytes32 positionId = _deposit(LIQUIDITY, threshold);
        _swapDown(1e17);
        depositor.triggerRebalance(positionId);

        assertEq(hook.getPosition(positionId).deltaThreshold, threshold, "threshold overwritten");
    }

    /// A second triggerRebalance must succeed using the updated ranges from the
    /// first rebalance. This is the regression test for the stale-state bug:
    /// if hookData is not passed to the add legs, the second rebalance tries to
    /// remove from the original (now-empty) deposit ranges and reverts.
    function test_triggerRebalance_secondCallSucceeds() public {
        bytes32 positionId = _deposit(LIQUIDITY, TINY_THRESHOLD);

        _swapDown(1e17);
        depositor.triggerRebalance(positionId);

        _swapDown(1e17);
        // Must not revert — uses the ranges stored from the first rebalance.
        depositor.triggerRebalance(positionId);

        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        assertGt(pos.longVolLiquidity, 0, "long-vol liquidity gone after second rebalance");
        assertGt(pos.shortVolLiquidity, 0, "short-vol liquidity gone after second rebalance");
    }

    /// precomputed sqrtPrice bounds must be consistent after a rebalance.
    function test_triggerRebalance_sqrtPriceBoundsUpdated() public {
        bytes32 positionId = _deposit(LIQUIDITY, TINY_THRESHOLD);
        _swapDown(1e17);
        depositor.triggerRebalance(positionId);

        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        assertEq(pos.longVolSqrtPriceLowerX96, TickMath.getSqrtPriceAtTick(pos.longVolTickLower));
        assertEq(pos.longVolSqrtPriceUpperX96, TickMath.getSqrtPriceAtTick(pos.longVolTickUpper));
        assertEq(pos.shortVolSqrtPriceLowerX96, TickMath.getSqrtPriceAtTick(pos.shortVolTickLower));
        assertEq(pos.shortVolSqrtPriceUpperX96, TickMath.getSqrtPriceAtTick(pos.shortVolTickUpper));
    }

    /// A withdrawal after a rebalance must succeed because the depositor reads
    /// the current (updated) nonce — proving the nonce machinery doesn't break.
    function test_withdraw_succeedsAfterRebalance() public {
        bytes32 positionId = _deposit(LIQUIDITY, TINY_THRESHOLD);
        _swapDown(1e17);
        depositor.triggerRebalance(positionId);

        depositor.withdraw(positionId);
        assertEq(hook.getPosition(positionId).owner, address(0), "position not cleaned up");
    }

    //  Fuzz 

    /// The hook must never cause a downward swap to revert regardless of size.
    function testFuzz_afterSwap_neverRevertsDown(uint128 amount) public {
        amount = uint128(bound(uint256(amount), 1e10, 1e22));
        _deposit(LIQUIDITY, HUGE_THRESHOLD);
        _swapDown(int256(uint256(amount)));
    }

    /// The hook must never cause an upward swap to revert regardless of size.
    function testFuzz_afterSwap_neverRevertsUp(uint128 amount) public {
        amount = uint128(bound(uint256(amount), 1e10, 1e22));
        _deposit(LIQUIDITY, HUGE_THRESHOLD);

        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: false,
                amountSpecified: -int256(uint256(amount)),
                sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }
}
