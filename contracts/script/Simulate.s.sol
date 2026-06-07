// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Anvil simulation — runs against a local Anvil fork of Unichain Sepolia.

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeltaHook} from "../src/DriftGuard.sol";
import {DeltaDepositor} from "../src/DeltaDepositor.sol";

contract Simulate is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // Must match Deploy.s.sol defaults
    int24 constant TICK_SPACING = 10;
    uint24 constant FEE = 3000;

    // 1e20 liquidity per leg — same order of magnitude as the fork tests.
    uint128 constant LIQUIDITY = 1e20;

    // threshold=1 fires RebalanceNeeded after every swap.
    // Production note: size this to ~0.05 * position_value_in_token0.
    uint256 constant DELTA_THRESHOLD = 1;

    // Five equal tick steps from 0 to ~-1626 (≈15% price drop).
    // ln(0.85) / ln(1.0001) ≈ -1626 ticks total; 1626 / 5 = ~325 per step.
    int24 constant TICK_STEP = 325;

    // Large exact-input ceiling; sqrtPriceLimitX96 controls the actual stop point.
    int256 constant SWAP_AMOUNT = -1e24;

    // Small offset for stabilizing swaps (ticks around the post-rebalance center).
    int24 constant STABILIZE_OFFSET = 50;

    IPoolManager poolManager;
    DeltaHook hook;
    DeltaDepositor depositor;
    PoolSwapTest swapRouter;
    Currency currency0;
    Currency currency1;
    PoolKey key;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        poolManager = IPoolManager(vm.envAddress("UNICHAIN_POOL_MANAGER"));
        hook = DeltaHook(vm.envAddress("DELTA_HOOK"));
        depositor = DeltaDepositor(vm.envAddress("DELTA_DEPOSITOR"));
        currency0 = Currency.wrap(vm.envAddress("CURRENCY0"));
        currency1 = Currency.wrap(vm.envAddress("CURRENCY1"));

        key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });

        vm.startBroadcast(deployerKey);

        // PoolSwapTest is a test helper — not deployed on real chains.
        // We deploy it fresh on Anvil so the simulation can perform swaps.
        swapRouter = new PoolSwapTest(poolManager);
        IERC20(Currency.unwrap(currency0)).approve(address(swapRouter), type(uint256).max);
        IERC20(Currency.unwrap(currency1)).approve(address(swapRouter), type(uint256).max);

        //  Step 1: Deposit 
        // Splits LIQUIDITY into long-vol and short-vol legs centered on tick 0.
        // Emits: PositionRegistered
        bytes32 positionId = depositor.deposit(key, LIQUIDITY, DELTA_THRESHOLD);

        vm.stopBroadcast();
        _logPosition("After deposit", positionId);
        vm.startBroadcast(deployerKey);

        //  Step 2: Five swaps pushing price down ~15% 
        // Each swap emits RebalanceNeeded (threshold=1 fires on every non-trivial swap).
        // triggerRebalance is intentionally withheld until after all five swaps.
        for (uint256 i = 1; i <= 5; i++) {
            int24 targetTick = -TICK_STEP * int24(int256(i));
            _swapToTick(targetTick);

            vm.stopBroadcast();
            _logDelta(i, positionId);
            vm.startBroadcast(deployerKey);
        }

        //  Step 3: Trigger rebalance 
        // Repositions both legs around the current price center.
        // Emits: RebalanceExecuted (new in this commit — fires from _afterAddLiquidity
        //        when a position re-add is detected for an already-registered positionId)
        depositor.triggerRebalance(positionId);

        vm.stopBroadcast();
        _logPosition("After triggerRebalance", positionId);
        vm.startBroadcast(deployerKey);

        //  Step 4: Three stabilizing swaps around the new center 
        // These are small movements (±50–150 ticks) relative to the post-rebalance
        // center. The position is now centred here, so these should produce lower
        // absolute delta growth than the 325-tick steps above.
        (, int24 centerAfterRebalance,,) = poolManager.getSlot0(key.toId());

        _swapToTick(centerAfterRebalance - STABILIZE_OFFSET);     // small move down
        vm.stopBroadcast(); _logDelta(6, positionId); vm.startBroadcast(deployerKey);

        _swapToTick(centerAfterRebalance + STABILIZE_OFFSET * 2); // recover up
        vm.stopBroadcast(); _logDelta(7, positionId); vm.startBroadcast(deployerKey);

        _swapToTick(centerAfterRebalance - STABILIZE_OFFSET / 2); // settle down
        vm.stopBroadcast(); _logDelta(8, positionId); vm.startBroadcast(deployerKey);

        vm.stopBroadcast();

        console2.log("\n=== SIMULATION COMPLETE ===");
        console2.log("positionId :", vm.toString(positionId));
        console2.log("Run this to verify final ranges:");
        console2.log(
            string.concat(
                "  cast call ",
                vm.toString(address(hook)),
                " 'getPosition(bytes32)' ",
                vm.toString(positionId),
                " --rpc-url http://localhost:8545"
            )
        );
    }

    //  Internal helpers 

    // Swap until price reaches targetTick (or as close as the exact-input ceiling allows).
    // Direction is inferred automatically: negative targetTick → zeroForOne, else oneForZero.
    function _swapToTick(int24 targetTick) internal {
        (, int24 currentTick,,) = poolManager.getSlot0(key.toId());
        bool zeroForOne = targetTick < currentTick;

        // For zeroForOne, limit must be strictly above MIN and below current price.
        // For oneForZero, limit must be strictly below MAX and above current price.
        uint160 sqrtLimit = zeroForOne
            ? TickMath.getSqrtPriceAtTick(targetTick) + 1
            : TickMath.getSqrtPriceAtTick(targetTick) - 1;

        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: SWAP_AMOUNT,
                sqrtPriceLimitX96: sqrtLimit
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function _logPosition(string memory label, bytes32 positionId) internal {
        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        (, int24 tick,,) = poolManager.getSlot0(key.toId());
        console2.log(string.concat("\n[", label, "]"));
        console2.log("  currentTick       :", vm.toString(int256(tick)));
        console2.log("  longVol  range    :", vm.toString(int256(pos.longVolTickLower)), "->", vm.toString(int256(pos.longVolTickUpper)));
        console2.log("  shortVol range    :", vm.toString(int256(pos.shortVolTickLower)), "->", vm.toString(int256(pos.shortVolTickUpper)));
        console2.log("  lastNetDelta      :", vm.toString(pos.lastNetDelta));
        console2.log("  stateNonce        :", vm.toString(hook.stateNonce(positionId)));
    }

    function _logDelta(uint256 swapNum, bytes32 positionId) internal {
        DeltaHook.SubPositionState memory pos = hook.getPosition(positionId);
        (, int24 tick,,) = poolManager.getSlot0(key.toId());
        console2.log(
            string.concat(
                "[swap ", vm.toString(swapNum), "] tick=", vm.toString(int256(tick)),
                "  lastNetDelta=", vm.toString(pos.lastNetDelta)
            )
        );
    }
}
