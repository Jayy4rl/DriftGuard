// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

// ComputeLPDelta tests

contract ComputeLPDeltaHarness {
    function computeLPDelta(
        uint160 sqrtPriceCurrentX96,
        uint160 sqrtPriceLowerX96,
        uint160 sqrtPriceUpperX96,
        uint128 liquidity
    ) public pure returns (uint256) {
        if (sqrtPriceCurrentX96 >= sqrtPriceUpperX96) return 0;
        if (sqrtPriceCurrentX96 <= sqrtPriceLowerX96) {
            return SqrtPriceMath.getAmount0Delta(sqrtPriceLowerX96, sqrtPriceUpperX96, liquidity, false);
        }
        return SqrtPriceMath.getAmount0Delta(sqrtPriceCurrentX96, sqrtPriceUpperX96, liquidity, false);
    }
}

contract ComputeLPDeltaTest is Test {
    ComputeLPDeltaHarness h;

    // ETH/USDC range roughly $1977–$3231 around a $2500 midpoint
    uint160 immutable SQRT_LOWER = TickMath.getSqrtPriceAtTick(73000);
    uint160 immutable SQRT_UPPER = TickMath.getSqrtPriceAtTick(79000);
    uint160 immutable SQRT_MID = TickMath.getSqrtPriceAtTick(76000);
    uint128 constant LIQ = 1e18;

    function setUp() public {
        h = new ComputeLPDeltaHarness();
    }

    function test_AboveRange_ReturnsZero() public view {
        assertEq(h.computeLPDelta(SQRT_UPPER, SQRT_LOWER, SQRT_UPPER, LIQ), 0);
        assertEq(h.computeLPDelta(TickMath.getSqrtPriceAtTick(82000), SQRT_LOWER, SQRT_UPPER, LIQ), 0);
    }

    function test_BelowRange_ReturnsMax() public view {
        uint256 max = SqrtPriceMath.getAmount0Delta(SQRT_LOWER, SQRT_UPPER, LIQ, false);
        assertEq(h.computeLPDelta(SQRT_LOWER, SQRT_LOWER, SQRT_UPPER, LIQ), max);
        assertEq(h.computeLPDelta(TickMath.getSqrtPriceAtTick(70000), SQRT_LOWER, SQRT_UPPER, LIQ), max);
    }

    function test_InRange_ReturnsPartial() public view {
        uint256 max = SqrtPriceMath.getAmount0Delta(SQRT_LOWER, SQRT_UPPER, LIQ, false);
        uint256 delta = h.computeLPDelta(SQRT_MID, SQRT_LOWER, SQRT_UPPER, LIQ);
        assertGt(delta, 0);
        assertLt(delta, max);
    }

    function test_InRange_MatchesLibraryDirectly() public view {
        uint256 expected = SqrtPriceMath.getAmount0Delta(SQRT_MID, SQRT_UPPER, LIQ, false);
        assertEq(h.computeLPDelta(SQRT_MID, SQRT_LOWER, SQRT_UPPER, LIQ), expected);
    }

    function test_ZeroLiquidity_AlwaysZero() public view {
        assertEq(h.computeLPDelta(SQRT_MID, SQRT_LOWER, SQRT_UPPER, 0), 0);
        assertEq(h.computeLPDelta(SQRT_LOWER, SQRT_LOWER, SQRT_UPPER, 0), 0);
        assertEq(h.computeLPDelta(SQRT_UPPER, SQRT_LOWER, SQRT_UPPER, 0), 0);
    }
}

// ComputeRanges tests

contract ComputeRangesHarness {
    int24 public constant RANGE_WIDTH = 2000;

    function computeRanges(int24 currentTick, int24 tickSpacing)
        public
        pure
        returns (int24 longVolTickLower, int24 longVolTickUpper, int24 shortVolTickLower, int24 shortVolTickUpper)
    {
        int24 center = currentTick < 0
            ? ((currentTick - tickSpacing + 1) / tickSpacing) * tickSpacing
            : (currentTick / tickSpacing) * tickSpacing;

        longVolTickLower = center - RANGE_WIDTH;
        longVolTickUpper = center;
        shortVolTickLower = center;
        shortVolTickUpper = center + RANGE_WIDTH;
    }
}

contract ComputeRangesTest is Test {
    ComputeRangesHarness h;

    function setUp() public {
        h = new ComputeRangesHarness();
    }

    // Positive tick: standard truncation gives the correct floor.
    function test_PositiveTick_FloorCorrect() public view {
        (, int24 longUpper,,) = h.computeRanges(105, 10);
        assertEq(longUpper, 100, "positive tick floor wrong");
    }

    // Positive tick already aligned: no rounding needed.
    function test_PositiveTick_AlreadyAligned() public view {
        (, int24 longUpper,,) = h.computeRanges(100, 10);
        assertEq(longUpper, 100);
    }

    // Negative tick: Solidity truncates -105/10 to -10 (= -100), not -11 (= -110).
    // The fix must produce -110.
    function test_NegativeTick_FloorCorrect() public view {
        (, int24 longUpper,,) = h.computeRanges(-105, 10);
        assertEq(longUpper, -110, "negative tick floor wrong -- fix not applied");
    }

    // Negative tick exactly on a boundary: -110 / 10 should floor to -110.
    function test_NegativeTick_ExactBoundary() public view {
        (, int24 longUpper,,) = h.computeRanges(-110, 10);
        assertEq(longUpper, -110);
    }

    // Tick -1: floor toward -∞ with spacing 10 gives -10.
    function test_NegativeTick_MinusOne() public view {
        (, int24 longUpper,,) = h.computeRanges(-1, 10);
        assertEq(longUpper, -10);
    }

    // The long-vol upper and short-vol lower are always the same (shared center).
    function test_CenterIsSharedBoundary() public view {
        (, int24 longUpper, int24 shortLower,) = h.computeRanges(77, 10);
        assertEq(longUpper, shortLower, "center is not shared between legs");
    }

    // Ranges are always exactly RANGE_WIDTH wide.
    function test_RangeWidthCorrect() public view {
        int24 rw = h.RANGE_WIDTH();
        (int24 lll, int24 llu, int24 sul, int24 suu) = h.computeRanges(500, 60);
        assertEq(llu - lll, rw);
        assertEq(suu - sul, rw);
    }

    // Fuzz: center is always a non-positive multiple of tickSpacing
    // and never greater than currentTick.
    function testFuzz_CenterNeverExceedsCurrentTick(int24 tick) public view {
        // Clamp tick to a range that keeps output within TickMath bounds.
        tick = int24(bound(int256(tick), -800_000, 800_000));
        int24 spacing = 10;
        (, int24 center,,) = h.computeRanges(tick, spacing);
        assertLe(center, tick, "center exceeds currentTick");
        assertEq(center % spacing, 0, "center not aligned to tickSpacing");
    }

    // Fuzz: center alignment holds for any valid tickSpacing (1–200).
    function testFuzz_CenterAlignedForAnySpacing(int24 tick, int24 spacing) public view {
        spacing = int24(bound(int256(spacing), 1, 200));
        tick = int24(bound(int256(tick), -800_000, 800_000));
        (, int24 center,,) = h.computeRanges(tick, spacing);
        assertEq(center % spacing, 0, "center not aligned");
        assertLe(center, tick, "center exceeds tick");
    }
}
