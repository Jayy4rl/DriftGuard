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

        
        DeltaHookRSC rsc = new DeltaHookRSC(deltaHook, deltaDepositor, chainId);

        vm.stopBroadcast();

        console2.log("\n=== RSC DEPLOYMENT SUMMARY ===");
        console2.log("DeltaHookRSC    :", address(rsc));
        console2.log("CHAIN_ID        :", rsc.CHAIN_ID());
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Fund RSC with native coin for ongoing subscription fees:");
        console2.log("     cast send $RSC_ADDRESS --value 0.1ether --rpc-url $RN_RPC_URL --private-key $PRIVATE_KEY");
        console2.log("  2. Verify subscriptions registered on Reactive Network explorer.");
        console2.log("  3. Confirm rscRelay set on Unichain:");
        console2.log("     cast call $DELTA_HOOK 'rscRelay()(address)' --rpc-url $UNICHAIN_RPC_URL");
        console2.log("     # Must match RN callback proxy, not the RSC address.");
        console2.log("  4. End-to-end smoke test:");
        console2.log("     - Deposit via DeltaDepositor on Unichain");
        console2.log("     - Execute a swap that breaches deltaThreshold");
        console2.log("     - Observe RebalanceNeeded emitted on Unichain");
        console2.log("     - Within ~30s, confirm triggerRebalance tx on Unichain from RSC");
    }
}
