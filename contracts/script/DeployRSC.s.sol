// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import {Script, console2} from "forge-std/Script.sol";
import {DeltaHookRSC} from "../src/DeltaHookRSC.sol";

contract DeployRSC is Script {
    // Unichain Sepolia chain ID — default target for the RSC subscriptions.
    // Override with UNICHAIN_CHAIN_ID env var for Mainnet (130).
    uint256 constant UNICHAIN_SEPOLIA = 1301;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        address deltaHook = vm.envAddress("DELTA_HOOK");
        address deltaDepositor = vm.envAddress("DELTA_DEPOSITOR");
        uint256 chainId = vm.envOr("UNICHAIN_CHAIN_ID", UNICHAIN_SEPOLIA);

        console2.log("Deploying DeltaHookRSC on Reactive Network...");
        console2.log("  DeltaHook      :", deltaHook);
        console2.log("  DeltaDepositor :", deltaDepositor);
        console2.log("  Unichain ID    :", chainId);
        console2.log("  RN chain ID    :", block.chainid);

        vm.startBroadcast(deployerKey);

        // Constructor subscribes to all four event streams on Unichain when
        // deployed to the real Reactive Network (vm = false there).
        // On testnet the RSC will receive events from Unichain Sepolia (chainId 1301).
        DeltaHookRSC rsc = new DeltaHookRSC(deltaHook, deltaDepositor, chainId);

        vm.stopBroadcast();

        console2.log("\n=== RSC DEPLOYMENT SUMMARY ===");
        console2.log("DeltaHookRSC    :", address(rsc));
        console2.log("CHAIN_ID        :", rsc.CHAIN_ID());
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Fund with ETH for subscription gas:");
        console2.log("     cast send", address(rsc));
        console2.log("       --value 0.1ether --rpc-url $RN_RPC_URL");
        console2.log("  2. Verify RSC subscriptions registered (constructor can fail silently):");
        console2.log("     cast call $RSC_ADDRESS 'CHAIN_ID()(uint256)' --rpc-url $RN_RPC_URL");
        console2.log("     # Expected: UNICHAIN_CHAIN_ID. If call reverts, redeploy.");
        console2.log("     # Also check Reactive Network explorer for subscription events.");
        console2.log("  3. Confirm setRscRelay was called on Unichain:");
        console2.log("     cast call $DELTA_HOOK 'rscRelay()(address)' --rpc-url $UNICHAIN_RPC_URL");
        console2.log("     # Must match RN callback proxy, not the RSC address.");
        console2.log("  4. End-to-end smoke test:");
        console2.log("     - Deposit via DeltaDepositor on Unichain");
        console2.log("     - Do a swap that breaches deltaThreshold");
        console2.log("     - Observe RebalanceNeeded emitted on Unichain");
        console2.log("     - Within ~30s, confirm triggerRebalance tx on Unichain from RSC");
    }
}
