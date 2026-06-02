// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AbstractPausableReactive} from "reactive-lib/abstract-base/AbstractPausableReactive.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";

// Reactive Smart Contract deployed on Reactive Network.
//
// Subscribes to four DeltaHook event streams on Base. When they fire, emits
// Callback instructions that the Reactive Network Callback Proxy executes on Base.
//
// Role: edge case handler and health monitor. Routine delta monitoring and
// RebalanceNeeded detection happens in afterSwap on Base — this RSC handles
// what the hook cannot do within a swap context (out-of-range recovery) and
// responds to alerts (invariant violations, position closure cleanup).
//
// Deployment: Reactive Network mainnet (chain distinct from Base).
// After deployment: set hook.rscRelay() on Base to the Reactive Network
// Callback Proxy address so DeltaDepositor.triggerRebalance() accepts the call.

contract DeltaHookRSC is AbstractPausableReactive {
    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 constant BASE_CHAIN_ID = 8453;
    uint64 constant CALLBACK_GAS_LIMIT = 400_000; // two modifyLiquidity removes + two adds + settlement
    uint256 constant RECOVERY_COOLDOWN = 300; // 5 min between recovery attempts per position

    // ─── Immutables (topic selectors computed at deploy time) ─────────────────
    // Cannot be `constant` — keccak256 is evaluated at runtime in Solidity.
    uint256 public immutable TOPIC_REBALANCE_NEEDED;
    uint256 public immutable TOPIC_OUT_OF_RANGE;
    uint256 public immutable TOPIC_INVARIANT_VIOLATED;
    uint256 public immutable TOPIC_POSITION_CLOSED;

    // ─── State ────────────────────────────────────────────────────────────────

    address public hook; // DeltaHook on Base — source of subscribed events
    address public depositor; // DeltaDepositor on Base — callback target

    // ReactVM instance state — persists across react() invocations.
    mapping(bytes32 positionId => uint256) public lastRecoveryTimestamp;
    mapping(bytes32 positionId => bool) public closedPositions;

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _hook, address _depositor) {
        // AbstractReactive constructor has already run (via inheritance chain):
        //   vendor = service = SERVICE_ADDR (0x...fffFfF)
        //   addAuthorizedSender(SERVICE_ADDR)
        //   detectVm() → vm = false on RN (code exists at system address),
        //                vm = true  in ReactVM and in Foundry/Base tests (no code)
        // AbstractPausableReactive constructor has already run:
        //   owner = msg.sender

        hook = _hook;
        depositor = _depositor;

        TOPIC_REBALANCE_NEEDED = uint256(keccak256("RebalanceNeeded(bytes32,int256,uint256)"));
        TOPIC_OUT_OF_RANGE = uint256(keccak256("PositionOutOfRange(bytes32,uint256)"));
        TOPIC_INVARIANT_VIOLATED = uint256(keccak256("PositionInvariantViolated(bytes32,string)"));
        TOPIC_POSITION_CLOSED = uint256(keccak256("PositionClosed(bytes32,int256)"));

        // Subscribe only on main Reactive Network (vm = false).
        // In ReactVM and in tests, vm = true → subscriptions are skipped.
        if (!vm) {
            service.subscribe(
                BASE_CHAIN_ID, _hook, TOPIC_REBALANCE_NEEDED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
            service.subscribe(
                BASE_CHAIN_ID, _hook, TOPIC_OUT_OF_RANGE, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
            service.subscribe(
                BASE_CHAIN_ID, _hook, TOPIC_INVARIANT_VIOLATED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
            service.subscribe(
                BASE_CHAIN_ID, _hook, TOPIC_POSITION_CLOSED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
        }
    }

    // ─── react() ──────────────────────────────────────────────────────────────

    // Called by Reactive Network validators when a subscribed event fires on Base.
    //
    // vmOnly ensures this runs only in ReactVM (vm = true) — the isolated context
    // where event processing happens. On the main Reactive Network instance (vm = false),
    // react() must never run — that instance manages subscriptions only.
    //
    // In Foundry tests, vm = true (no system contract at 0x...fffFfF), so vmOnly
    // passes and react() is directly testable without Reactive Network infrastructure.
    function react(IReactive.LogRecord calldata log) external override vmOnly {
        bytes32 positionId = bytes32(log.topic_1);

        // ── PositionClosed ─────────────────────────────────────────────────
        // Position fully withdrawn. Mark closed, clean up cooldown state.
        if (log.topic_0 == TOPIC_POSITION_CLOSED) {
            closedPositions[positionId] = true;
            delete lastRecoveryTimestamp[positionId];
            return;
        }

        if (closedPositions[positionId]) return;

        // ── RebalanceNeeded + PositionOutOfRange ───────────────────────────
        // Both trigger depositor.triggerRebalance(positionId) on Base.
        // Rate-limited to prevent overlapping callbacks for the same position.
        if (log.topic_0 == TOPIC_REBALANCE_NEEDED || log.topic_0 == TOPIC_OUT_OF_RANGE) {
            if (block.timestamp < lastRecoveryTimestamp[positionId] + RECOVERY_COOLDOWN) return;
            lastRecoveryTimestamp[positionId] = block.timestamp;

            emit Callback(
                BASE_CHAIN_ID,
                depositor,
                CALLBACK_GAS_LIMIT,
                abi.encodeWithSignature("triggerRebalance(bytes32)", positionId)
            );
            return;
        }

        // ── PositionInvariantViolated ──────────────────────────────────────
        // No cooldown — invariant violations are always urgent.
        // emergencyPause(bytes32) is a v2 addition to DeltaDepositor; wired here
        // so the RSC is ready when that function is added.
        if (log.topic_0 == TOPIC_INVARIANT_VIOLATED) {
            emit Callback(
                BASE_CHAIN_ID,
                depositor,
                CALLBACK_GAS_LIMIT,
                abi.encodeWithSignature("emergencyPause(bytes32)", positionId)
            );
        }
    }

    // ─── getPausableSubscriptions() ───────────────────────────────────────────

    // Called by AbstractPausableReactive.pause() and .resume() to know which
    // subscriptions to unsubscribe and resubscribe. Must mirror the constructor
    // subscribe calls exactly — same chain, contract, and topic filters.
    function getPausableSubscriptions() internal view override returns (Subscription[] memory subs) {
        subs = new Subscription[](4);
        subs[0] = Subscription(
            BASE_CHAIN_ID, hook, TOPIC_REBALANCE_NEEDED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
        subs[1] = Subscription(
            BASE_CHAIN_ID, hook, TOPIC_OUT_OF_RANGE, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
        subs[2] = Subscription(
            BASE_CHAIN_ID, hook, TOPIC_INVARIANT_VIOLATED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
        subs[3] = Subscription(
            BASE_CHAIN_ID, hook, TOPIC_POSITION_CLOSED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    // rnOnly: admin operations only valid on main Reactive Network (vm = false).
    function setDepositor(address _depositor) external onlyOwner rnOnly {
        depositor = _depositor;
    }

    function setHook(address _hook) external onlyOwner rnOnly {
        hook = _hook;
    }
}
