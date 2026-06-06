// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AbstractPausableReactive} from "reactive-lib/abstract-base/AbstractPausableReactive.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";


contract DeltaHookRSC is AbstractPausableReactive {
    //  Constants 

    uint64 constant CALLBACK_GAS_LIMIT = 400_000; // two modifyLiquidity removes + two adds + settlement
    uint256 constant RECOVERY_COOLDOWN = 300; // 5 min between recovery attempts per position

    //  Immutables 

    // Target chain for subscriptions and callbacks. Set at deploy time so the
    // same bytecode serves both Unichain Sepolia (1301) and Mainnet (130).
    uint256 public immutable CHAIN_ID;

    // Topic selectors — cannot be constant because keccak256 is runtime.
    uint256 public immutable TOPIC_REBALANCE_NEEDED;
    uint256 public immutable TOPIC_OUT_OF_RANGE;
    uint256 public immutable TOPIC_INVARIANT_VIOLATED;
    uint256 public immutable TOPIC_POSITION_CLOSED;

    //  State 

    address public hook;      // DeltaHook on Unichain — source of subscribed events
    address public depositor; // DeltaDepositor on Unichain — callback target

    // ReactVM instance state — persists across react() invocations.
    mapping(bytes32 positionId => uint256) public lastRecoveryTimestamp;
    mapping(bytes32 positionId => bool) public closedPositions;

    //  Constructor 

    constructor(address _hook, address _depositor, uint256 _chainId) {
        // AbstractReactive constructor has already run (via inheritance chain):
        //   vendor = service = SERVICE_ADDR (0x...fffFfF)
        //   addAuthorizedSender(SERVICE_ADDR)
        //   detectVm() → vm = false on RN (code exists at system address),
        //                vm = true  in ReactVM and in Foundry/Unichain tests (no code)
        // AbstractPausableReactive constructor has already run:
        //   owner = msg.sender

        hook = _hook;
        depositor = _depositor;
        CHAIN_ID = _chainId;

        TOPIC_REBALANCE_NEEDED = uint256(keccak256("RebalanceNeeded(bytes32,int256,uint256)"));
        TOPIC_OUT_OF_RANGE = uint256(keccak256("PositionOutOfRange(bytes32,uint256)"));
        TOPIC_INVARIANT_VIOLATED = uint256(keccak256("PositionInvariantViolated(bytes32,string)"));
        TOPIC_POSITION_CLOSED = uint256(keccak256("PositionClosed(bytes32,int256)"));

        // Subscribe only on main Reactive Network (vm = false).
        // In ReactVM and in tests, vm = true → subscriptions are skipped.
        if (!vm) {
            service.subscribe(_chainId, _hook, TOPIC_REBALANCE_NEEDED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
            service.subscribe(_chainId, _hook, TOPIC_OUT_OF_RANGE, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
            service.subscribe(_chainId, _hook, TOPIC_INVARIANT_VIOLATED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
            service.subscribe(_chainId, _hook, TOPIC_POSITION_CLOSED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        }
    }

    //  react() 

   
    function react(IReactive.LogRecord calldata log) external override vmOnly {
        bytes32 positionId = bytes32(log.topic_1);

        //  PositionClosed 
        // Position fully withdrawn. Mark closed, clean up cooldown state.
        if (log.topic_0 == TOPIC_POSITION_CLOSED) {
            closedPositions[positionId] = true;
            delete lastRecoveryTimestamp[positionId];
            return;
        }

        if (closedPositions[positionId]) return;

        //  RebalanceNeeded + PositionOutOfRange 
        // Both trigger depositor.triggerRebalance(positionId) on Unichain.
        // Rate-limited to prevent overlapping callbacks for the same position.
        if (log.topic_0 == TOPIC_REBALANCE_NEEDED || log.topic_0 == TOPIC_OUT_OF_RANGE) {
            if (block.timestamp < lastRecoveryTimestamp[positionId] + RECOVERY_COOLDOWN) return;
            lastRecoveryTimestamp[positionId] = block.timestamp;

            emit Callback(
                CHAIN_ID,
                depositor,
                CALLBACK_GAS_LIMIT,
                abi.encodeWithSignature("triggerRebalance(bytes32)", positionId)
            );
            return;
        }

        //  PositionInvariantViolated 
        // No cooldown — invariant violations are always urgent.
        if (log.topic_0 == TOPIC_INVARIANT_VIOLATED) {
            emit Callback(
                CHAIN_ID,
                depositor,
                CALLBACK_GAS_LIMIT,
                abi.encodeWithSignature("emergencyPause(bytes32)", positionId)
            );
        }
    }

    //  getPausableSubscriptions() 

    // Called by AbstractPausableReactive.pause() and .resume() to know which
    // subscriptions to unsubscribe and resubscribe. Must mirror the constructor
    // subscribe calls exactly — same chain, contract, and topic filters.
    function getPausableSubscriptions() internal view override returns (Subscription[] memory subs) {
        subs = new Subscription[](4);
        subs[0] = Subscription(CHAIN_ID, hook, TOPIC_REBALANCE_NEEDED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        subs[1] = Subscription(CHAIN_ID, hook, TOPIC_OUT_OF_RANGE, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        subs[2] = Subscription(CHAIN_ID, hook, TOPIC_INVARIANT_VIOLATED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        subs[3] = Subscription(CHAIN_ID, hook, TOPIC_POSITION_CLOSED, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    //  Admin 

    // rnOnly: admin operations only valid on main Reactive Network (vm = false).
    function setDepositor(address _depositor) external onlyOwner rnOnly {
        depositor = _depositor;
    }

    function setHook(address _hook) external onlyOwner rnOnly {
        hook = _hook;
    }
}
