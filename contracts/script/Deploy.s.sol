// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * Deploy DeltaHook + DeltaDepositor to Unichain and wire them together.
 *
 * Required env vars:
 *   PRIVATE_KEY               — deployer wallet private key (hex, no 0x prefix)
 *   UNICHAIN_POOL_MANAGER     — Uniswap v4 PoolManager address on Unichain
 *   RN_CALLBACK_PROXY         — Reactive Network Callback Proxy on Unichain
 *                               (get from https://dev.reactive.network/deployments)
 *
 * Optional env vars:
 *   CURRENCY0                 — token0 address (default: zero address = native ETH)
 *   CURRENCY1                 — token1 address (e.g. USDC on Unichain Sepolia)
 *   POOL_FEE                  — fee tier in hundredths of a bip (default: 3000 = 0.3%)
 *   TICK_SPACING              — tick spacing (default: 10; must divide RANGE_WIDTH=2000)
 *   INITIAL_TICK              — pool initialisation tick (default: 0 = 1:1 ratio)
 *   DELTA_THRESHOLD           — rebalance threshold in token0 units (default: 5e16)
 *
 * Run (dry-run):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $UNICHAIN_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     -vvv
 *
 * Run (broadcast):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $UNICHAIN_SEPOLIA_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     -vvv
 *
 * Unichain addresses (verify before deploying):
 *   Unichain Mainnet  chain ID 130  https://uniscan.xyz
 *   Unichain Sepolia  chain ID 1301 https://sepolia.uniscan.xyz
 */

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {HookMiner} from "v4-hooks-public/test/utils/HookMiner.sol";
import {DeltaHook} from "../src/DriftGuard.sol";
import {DeltaDepositor} from "../src/DeltaDepositor.sol";

contract Deploy is Script {
    // ─── Constants ────────────────────────────────────────────────────────────

    // Default tick spacing — must divide RANGE_WIDTH=2000 evenly.
    // tickSpacing=10 → 2000 / 10 = 200 ✓
    int24 constant DEFAULT_TICK_SPACING = 10;
    uint24 constant DEFAULT_FEE = 3000; // 0.3%
    // Default threshold: 0.05 ETH (5e16 wei). Calibrate to ~0.1% of position value.
    uint256 constant DEFAULT_DELTA_THRESHOLD = 5e16;

    function run() external {
        // ── Env vars ──────────────────────────────────────────────────────────
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address poolManagerAddr = vm.envAddress("UNICHAIN_POOL_MANAGER");
        address rnCallbackProxy = vm.envOr("RN_CALLBACK_PROXY", address(0));

        address currency0Addr = vm.envOr("CURRENCY0", address(0));    // native ETH by default
        address currency1Addr = vm.envOr("CURRENCY1", address(0));
        uint24 fee = uint24(vm.envOr("POOL_FEE", uint256(DEFAULT_FEE)));
        int24 tickSpacing = int24(int256(vm.envOr("TICK_SPACING", uint256(uint24(DEFAULT_TICK_SPACING)))));
        int24 initialTick = int24(int256(vm.envOr("INITIAL_TICK", uint256(0))));
        uint256 deltaThreshold = vm.envOr("DELTA_THRESHOLD", DEFAULT_DELTA_THRESHOLD);

        IPoolManager manager = IPoolManager(poolManagerAddr);

        // ── Hook address mining ───────────────────────────────────────────────
        // In scripts the CREATE2 caller is the deployer wallet (the address that
        // signs the broadcast), NOT the script contract. Using address(this) here
        // would mine the wrong salt and the BaseHook constructor would revert.
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
        );

        console2.log("Mining hook address for deployer:", deployer);
        (address hookAddr, bytes32 salt) =
            HookMiner.find(deployer, flags, type(DeltaHook).creationCode, abi.encode(address(manager)));
        console2.log("Hook address found  :", hookAddr);
        console2.log("CREATE2 salt        :", uint256(salt));

        // ── Deployment ────────────────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        // 1. Deploy DeltaHook at the mined CREATE2 address.
        //    `new Hook{salt: salt}(...)` uses CREATE2 with msg.sender (= deployer
        //    wallet inside broadcast) as the factory — matching what HookMiner computed.
        DeltaHook hook = new DeltaHook{salt: salt}(manager);
        require(address(hook) == hookAddr, "hook address mismatch: wrong salt or flags");

        // 2. Deploy DeltaDepositor. depositorOwner = deployer wallet (msg.sender).
        DeltaDepositor depositor = new DeltaDepositor(manager, hook);

        // 3. Wire vault — one-time; deployer becomes hook.deployer at construction.
        hook.setVault(address(depositor));

        // 4. Authorise Reactive Network callback proxy so RSC can call triggerRebalance.
        //    Skip if RN_CALLBACK_PROXY was not provided (useful for dry-runs).
        if (rnCallbackProxy != address(0)) {
            hook.setRscRelay(rnCallbackProxy);
        }

        // 5. Initialise pool if both currency addresses are provided.
        //    If CURRENCY1 is zero we skip pool initialisation — do it separately
        //    once you have the real token addresses for Unichain.
        if (currency1Addr != address(0)) {
            // Sort currencies: v4 requires currency0 < currency1 by address.
            if (currency0Addr > currency1Addr) {
                (currency0Addr, currency1Addr) = (currency1Addr, currency0Addr);
            }

            PoolKey memory poolKey = PoolKey({
                currency0: Currency.wrap(currency0Addr),
                currency1: Currency.wrap(currency1Addr),
                fee: fee,
                tickSpacing: tickSpacing,
                hooks: IHooks(address(hook))
            });

            uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(initialTick);
            manager.initialize(poolKey, sqrtPriceX96);

            console2.log("Pool initialised:");
            console2.log("  currency0   :", currency0Addr);
            console2.log("  currency1   :", currency1Addr);
            console2.log("  fee         :", fee);
            console2.log("  tickSpacing :", uint256(int256(tickSpacing)));
            console2.log("  initialTick :", uint256(int256(initialTick)));
        } else {
            console2.log("CURRENCY1 not set -- pool not initialised. Run InitPool.s.sol after.");
        }

        vm.stopBroadcast();

        // ── Summary ───────────────────────────────────────────────────────────
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID            :", block.chainid);
        console2.log("Deployer            :", deployer);
        console2.log("DeltaHook           :", address(hook));
        console2.log("DeltaDepositor      :", address(depositor));
        console2.log("PoolManager         :", poolManagerAddr);
        console2.log("RSC relay set       :", rnCallbackProxy != address(0));
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Note DeltaHook and DeltaDepositor addresses above.");
        console2.log("  2. Deploy DeltaHookRSC on Reactive Network:");
        console2.log("     forge script script/DeployRSC.s.sol \\");
        console2.log("       --rpc-url $RN_RPC_URL \\");
        console2.log("       --broadcast");
        console2.log("  3. Fund RSC with ETH on Reactive Network for subscription gas.");
        console2.log("  4. If RN_CALLBACK_PROXY was not set, run:");
        console2.log("     cast send $DELTA_HOOK 'setRscRelay(address)' $RN_CALLBACK_PROXY \\");
        console2.log("       --rpc-url $UNICHAIN_SEPOLIA_RPC_URL");
    }
}
