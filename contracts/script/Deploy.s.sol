// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
    //  Constants 

    int24 constant DEFAULT_TICK_SPACING = 10; // must divide RANGE_WIDTH=2000
    uint24 constant DEFAULT_FEE = 3000;       // 0.3%

    //  Shared state (set once in run, read by helpers) 
    IPoolManager internal _manager;

    //  Entry point 

    function run() external {
        _manager = IPoolManager(vm.envAddress("UNICHAIN_POOL_MANAGER"));

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        (DeltaHook hook, DeltaDepositor depositor) = _deploy(deployer);
        _configure(hook, depositor);
        _initPool(hook);

        vm.stopBroadcast();

        _logSummary(deployer, address(hook), address(depositor));
    }

    //  Internal helpers 

    function _deploy(address admin) internal returns (DeltaHook hook, DeltaDepositor depositor) {
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
        );

        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY, flags, type(DeltaHook).creationCode, abi.encode(address(_manager), admin)
        );

        hook = new DeltaHook{salt: salt}(_manager, admin);
        require(address(hook) == hookAddr, "hook address mismatch: wrong salt or flags");

        depositor = new DeltaDepositor(_manager, hook);
    }

    function _configure(DeltaHook hook, DeltaDepositor depositor) internal {
        hook.setDepositor(address(depositor));

        address rnProxy = vm.envOr("RN_CALLBACK_PROXY", address(0));
        if (rnProxy != address(0)) {
            hook.setRscRelay(rnProxy);
        }
    }

    function _initPool(DeltaHook hook) internal {
        address c0 = vm.envOr("CURRENCY0", address(0));
        address c1 = vm.envOr("CURRENCY1", address(0));

        if (c1 == address(0)) {
            console2.log("CURRENCY1 not set -- pool not initialised.");
            return;
        }

        uint24 fee = uint24(vm.envOr("POOL_FEE", uint256(DEFAULT_FEE)));
        int24 spacing = int24(int256(vm.envOr("TICK_SPACING", uint256(uint24(DEFAULT_TICK_SPACING)))));
        // vm.envOr with int256 default reads the var as signed, so negative ticks
        // (e.g. -207243 for ETH/USDC at ~$3000) are handled correctly.
        int24 tick = int24(vm.envOr("INITIAL_TICK", int256(0)));

        // v4 requires currency0 < currency1 by address value.
        if (c0 > c1) (c0, c1) = (c1, c0);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: fee,
            tickSpacing: spacing,
            hooks: IHooks(address(hook))
        });

        _manager.initialize(key, TickMath.getSqrtPriceAtTick(tick));

        console2.log("Pool initialised:");
        console2.log("  currency0   :", c0);
        console2.log("  currency1   :", c1);
        console2.log("  fee         :", fee);
        console2.log("  tickSpacing :", uint256(int256(spacing)));
        console2.log("  initialTick :", uint256(int256(tick)));
    }

    function _logSummary(address deployer, address hook, address depositor) internal view {
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID          :", block.chainid);
        console2.log("Deployer          :", deployer);
        console2.log("DeltaHook         :", hook);
        console2.log("DeltaDepositor    :", depositor);
        console2.log("PoolManager       :", address(_manager));
        console2.log("\nNext steps:");
        console2.log("  1. Deploy RSC on Reactive Network:");
        console2.log("       DELTA_HOOK=<hook> DELTA_DEPOSITOR=<depositor>\\");
        console2.log("       forge script script/DeployRSC.s.sol \\");
        console2.log("         --rpc-url $RN_RPC_URL --broadcast");
        console2.log("  2. Fund RSC with ETH on Reactive Network for subscription gas.");
        console2.log("  3. If RN_CALLBACK_PROXY was not set above, run:");
        console2.log("       cast send <hook> 'setRscRelay(address)' <proxy> \\");
        console2.log("         --rpc-url $UNICHAIN_RPC_URL");
    }
}
