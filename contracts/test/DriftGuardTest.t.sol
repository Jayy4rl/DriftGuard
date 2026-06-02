// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// forge test --match-contract ComputeLPDeltaTest -vvv

import {Test, console2} from "forge-std/Test.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

// Harness exposes the internal function for direct testing
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

    // Case 2: price at or above upper → 0 ETH
    function test_AboveRange_ReturnsZero() public view {
        assertEq(h.computeLPDelta(SQRT_UPPER, SQRT_LOWER, SQRT_UPPER, LIQ), 0);
        assertEq(h.computeLPDelta(TickMath.getSqrtPriceAtTick(82000), SQRT_LOWER, SQRT_UPPER, LIQ), 0);
    }

    // Case 1: price at or below lower → maximum ETH (full range)
    function test_BelowRange_ReturnsMax() public view {
        uint256 max = SqrtPriceMath.getAmount0Delta(SQRT_LOWER, SQRT_UPPER, LIQ, false);
        assertEq(h.computeLPDelta(SQRT_LOWER, SQRT_LOWER, SQRT_UPPER, LIQ), max);
        assertEq(h.computeLPDelta(TickMath.getSqrtPriceAtTick(70000), SQRT_LOWER, SQRT_UPPER, LIQ), max);
    }

    // Case 3: price in range → strictly between 0 and max
    function test_InRange_ReturnsPartial() public view {
        uint256 max = SqrtPriceMath.getAmount0Delta(SQRT_LOWER, SQRT_UPPER, LIQ, false);
        uint256 delta = h.computeLPDelta(SQRT_MID, SQRT_LOWER, SQRT_UPPER, LIQ);
        assertGt(delta, 0);
        assertLt(delta, max);
    }

    // Case 3 matches library directly — no extra logic introduced
    function test_InRange_MatchesLibraryDirectly() public view {
        uint256 expected = SqrtPriceMath.getAmount0Delta(SQRT_MID, SQRT_UPPER, LIQ, false);
        assertEq(h.computeLPDelta(SQRT_MID, SQRT_LOWER, SQRT_UPPER, LIQ), expected);
    }

    // Zero liquidity always returns zero regardless of price
    function test_ZeroLiquidity_AlwaysZero() public view {
        assertEq(h.computeLPDelta(SQRT_MID, SQRT_LOWER, SQRT_UPPER, 0), 0);
        assertEq(h.computeLPDelta(SQRT_LOWER, SQRT_LOWER, SQRT_UPPER, 0), 0);
        assertEq(h.computeLPDelta(SQRT_UPPER, SQRT_LOWER, SQRT_UPPER, 0), 0);
    }
}
