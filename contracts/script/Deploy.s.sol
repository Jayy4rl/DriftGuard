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
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {DeltaHook} from "../src/Vixa.sol";
import {DeltaDepositor} from "../src/DeltaDepositor.sol";

contract Deploy is Script {
    //  Constants

    int24 constant DEFAULT_TICK_SPACING = 10; // must divide RANGE_WIDTH=2000
    uint24 constant DEFAULT_FEE = 3000;       // 0.3%
    uint256 constant MINT_AMOUNT = 1_000_000e18;

    //  Shared state (set once in run, read by helpers)
    IPoolManager internal _manager;

    //  Entry point

    function run() external {
        _manager = IPoolManager(vm.envAddress("UNICHAIN_POOL_MANAGER"));

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        (address c0, address c1) = _deployTokens(deployer);
        (DeltaHook hook, DeltaDepositor depositor) = _deployContracts(deployer);
        _configure(hook, depositor);
        _initPool(hook, c0, c1);

        vm.stopBroadcast();

        _logSummary(deployer, c0, c1, address(hook), address(depositor));
    }

    //  Internal helpers

    // Deploys two 18-decimal mock tokens, mints MINT_AMOUNT to deployer, and returns
    // them sorted (currency0 < currency1) as required by v4 PoolKey.
    function _deployTokens(address deployer) internal returns (address c0, address c1) {
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 18);

        weth.mint(deployer, MINT_AMOUNT);
        usdc.mint(deployer, MINT_AMOUNT);

        (c0, c1) = address(weth) < address(usdc)
            ? (address(weth), address(usdc))
            : (address(usdc), address(weth));
    }

    function _deployContracts(address admin) internal returns (DeltaHook hook, DeltaDepositor depositor) {
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

    function _initPool(DeltaHook hook, address c0, address c1) internal {
        uint24 fee = uint24(vm.envOr("POOL_FEE", uint256(DEFAULT_FEE)));
        int24 spacing = int24(int256(vm.envOr("TICK_SPACING", uint256(uint24(DEFAULT_TICK_SPACING)))));
        // vm.envOr with int256 default reads the var as signed, so negative ticks
        // (e.g. -207243 for ETH/USDC at ~$3000) are handled correctly.
        int24 tick = int24(vm.envOr("INITIAL_TICK", int256(0)));

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

    function _logSummary(address deployer, address c0, address c1, address hook, address depositor) internal view {
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Chain ID          :", block.chainid);
        console2.log("Deployer          :", deployer);
        console2.log("CURRENCY0         :", c0);
        console2.log("CURRENCY1         :", c1);
        console2.log("DeltaHook         :", hook);
        console2.log("DeltaDepositor    :", depositor);
        console2.log("PoolManager       :", address(_manager));
        console2.log("\nSet these env vars for Simulate.s.sol:");
        console2.log("  export CURRENCY0=<above>");
        console2.log("  export CURRENCY1=<above>");
        console2.log("  export DELTA_HOOK=<above>");
        console2.log("  export DELTA_DEPOSITOR=<above>");
        console2.log("\nApprove depositor for both tokens:");
        console2.log("  cast send <CURRENCY0> 'approve(address,uint256)' <DELTA_DEPOSITOR> $(cast max-uint) --rpc-url $UNICHAIN_RPC_URL --private-key $PRIVATE_KEY");
        console2.log("  cast send <CURRENCY1> 'approve(address,uint256)' <DELTA_DEPOSITOR> $(cast max-uint) --rpc-url $UNICHAIN_RPC_URL --private-key $PRIVATE_KEY");
        console2.log("\nDeploy RSC on Reactive Network:");
        console2.log("  DELTA_HOOK=<hook> DELTA_DEPOSITOR=<depositor> forge script script/DeployRSC.s.sol --rpc-url $RN_RPC_URL --broadcast");
        console2.log("\nIf RN_CALLBACK_PROXY was not set above:");
        console2.log("  cast send <hook> 'setRscRelay(address)' <proxy> --rpc-url $UNICHAIN_RPC_URL --private-key $PRIVATE_KEY");
    }
}
