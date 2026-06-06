// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// forge test --match-contract DeltaHookRSCTest -vvv

import {Test, Vm} from "forge-std/Test.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";
import {DeltaHookRSC} from "../src/DeltaHookRSC.sol";

contract DeltaHookRSCTest is Test {
    //  Contracts 
    DeltaHookRSC rsc;

    //  Constants 
    address constant HOOK_ADDR = address(0x1111);
    address constant DEPOSITOR_ADDR = address(0x2222);
    // Use Unichain Sepolia for tests; matches the chain ID the RSC is constructed with.
    uint256 constant CHAIN_ID = 1301;
    uint64 constant CALLBACK_GAS_LIMIT = 400_000;
    uint256 constant RECOVERY_COOLDOWN = 300;

    bytes32 constant POSITION_ID = keccak256("test-position");

    //  Event mirror for vm.expectEmit 
    // Signature must match IReactive.Callback exactly so topic hashes agree.
    event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload);

    //  setUp 
    function setUp() public {
       
        rsc = new DeltaHookRSC(HOOK_ADDR, DEPOSITOR_ADDR, CHAIN_ID);

       
        vm.warp(RECOVERY_COOLDOWN + 1);
    }

    // Helpers 

    function _makeLog(uint256 topic0, bytes32 positionId) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: CHAIN_ID,
            _contract: HOOK_ADDR,
            topic_0: topic0,
            topic_1: uint256(positionId), // positionId is always topic_1 (indexed)
            topic_2: 0,
            topic_3: 0,
            data: "",
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }

    // RebalanceNeeded 

    /// react() on RebalanceNeeded must emit a Callback targeting the depositor.
    function test_react_RebalanceNeeded_emitsCallback() public {
        IReactive.LogRecord memory log = _makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID);

        vm.expectEmit(true, true, true, true, address(rsc));
        emit Callback(
            CHAIN_ID,
            DEPOSITOR_ADDR,
            CALLBACK_GAS_LIMIT,
            abi.encodeWithSignature("triggerRebalance(bytes32)", POSITION_ID)
        );
        rsc.react(log);
    }

    /// A second RebalanceNeeded within the cooldown window must be silently ignored.
    function test_react_RebalanceNeeded_cooldownBlocksSpam() public {
        IReactive.LogRecord memory log = _makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID);

        rsc.react(log); // first call — sets lastRecoveryTimestamp

        // No Callback must be emitted for the second call within the cooldown.
        vm.recordLogs();
        rsc.react(log);

        bytes32 cbSig = keccak256("Callback(uint256,address,uint64,bytes)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != cbSig, "Callback emitted inside cooldown window");
        }
    }

    /// After the cooldown expires a second RebalanceNeeded must fire again.
    function test_react_RebalanceNeeded_firesAgainAfterCooldown() public {
        IReactive.LogRecord memory log = _makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID);
        rsc.react(log);

        vm.warp(block.timestamp + RECOVERY_COOLDOWN + 1);

        vm.expectEmit(true, true, true, true, address(rsc));
        emit Callback(
            CHAIN_ID,
            DEPOSITOR_ADDR,
            CALLBACK_GAS_LIMIT,
            abi.encodeWithSignature("triggerRebalance(bytes32)", POSITION_ID)
        );
        rsc.react(log);
    }

    //  PositionOutOfRange 

    /// react() on PositionOutOfRange must emit the same triggerRebalance Callback.
    function test_react_OutOfRange_emitsCallback() public {
        IReactive.LogRecord memory log = _makeLog(rsc.TOPIC_OUT_OF_RANGE(), POSITION_ID);

        vm.expectEmit(true, true, true, true, address(rsc));
        emit Callback(
            CHAIN_ID,
            DEPOSITOR_ADDR,
            CALLBACK_GAS_LIMIT,
            abi.encodeWithSignature("triggerRebalance(bytes32)", POSITION_ID)
        );
        rsc.react(log);
    }

    /// OutOfRange respects the same cooldown as RebalanceNeeded.
    function test_react_OutOfRange_cooldownSharedAcrossEventTypes() public {
        // First call via RebalanceNeeded stamps the cooldown.
        rsc.react(_makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID));

        // Immediate OutOfRange for the same positionId must be silent.
        vm.recordLogs();
        rsc.react(_makeLog(rsc.TOPIC_OUT_OF_RANGE(), POSITION_ID));

        bytes32 cbSig = keccak256("Callback(uint256,address,uint64,bytes)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != cbSig, "Callback emitted during shared cooldown");
        }
    }

    //  PositionClosed 

    /// react() on PositionClosed must mark the position closed and emit nothing.
    function test_react_PositionClosed_marksClosedNoCallback() public {
        assertFalse(rsc.closedPositions(POSITION_ID));

        vm.recordLogs();
        rsc.react(_makeLog(rsc.TOPIC_POSITION_CLOSED(), POSITION_ID));

        assertTrue(rsc.closedPositions(POSITION_ID), "position not marked closed");

        bytes32 cbSig = keccak256("Callback(uint256,address,uint64,bytes)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != cbSig, "unexpected Callback on PositionClosed");
        }
    }

    /// Subsequent RebalanceNeeded for a closed position must be silently ignored.
    function test_react_ClosedPosition_subsequentRebalanceIgnored() public {
        rsc.react(_makeLog(rsc.TOPIC_POSITION_CLOSED(), POSITION_ID));

        vm.recordLogs();
        rsc.react(_makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID));

        bytes32 cbSig = keccak256("Callback(uint256,address,uint64,bytes)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != cbSig, "Callback emitted for closed position");
        }
    }

    /// PositionClosed must also clear the lastRecoveryTimestamp.
    function test_react_PositionClosed_clearsTimestamp() public {
        rsc.react(_makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID));
        assertGt(rsc.lastRecoveryTimestamp(POSITION_ID), 0, "timestamp not set");

        rsc.react(_makeLog(rsc.TOPIC_POSITION_CLOSED(), POSITION_ID));
        assertEq(rsc.lastRecoveryTimestamp(POSITION_ID), 0, "timestamp not cleared by PositionClosed");
    }

    //  PositionInvariantViolated 

    /// react() on PositionInvariantViolated must emit an emergencyPause Callback.
    function test_react_InvariantViolated_emitsEmergencyPauseCallback() public {
        IReactive.LogRecord memory log = _makeLog(rsc.TOPIC_INVARIANT_VIOLATED(), POSITION_ID);

        vm.expectEmit(true, true, true, true, address(rsc));
        emit Callback(
            CHAIN_ID,
            DEPOSITOR_ADDR,
            CALLBACK_GAS_LIMIT,
            abi.encodeWithSignature("emergencyPause(bytes32)", POSITION_ID)
        );
        rsc.react(log);
    }

    /// InvariantViolated has no cooldown — every violation triggers a callback.
    function test_react_InvariantViolated_noCooldown() public {
        IReactive.LogRecord memory log = _makeLog(rsc.TOPIC_INVARIANT_VIOLATED(), POSITION_ID);
        rsc.react(log);

        // Immediate second call must also emit.
        vm.expectEmit(true, true, true, true, address(rsc));
        emit Callback(
            CHAIN_ID,
            DEPOSITOR_ADDR,
            CALLBACK_GAS_LIMIT,
            abi.encodeWithSignature("emergencyPause(bytes32)", POSITION_ID)
        );
        rsc.react(log);
    }

    //  Unknown topic 

    /// An unrecognised topic_0 must produce no Callback.
    function test_react_unknownTopic_emitsNothing() public {
        IReactive.LogRecord memory log = _makeLog(uint256(keccak256("Unknown()")), POSITION_ID);

        vm.recordLogs();
        rsc.react(log);

        bytes32 cbSig = keccak256("Callback(uint256,address,uint64,bytes)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != cbSig, "Callback emitted for unknown topic");
        }
    }

    // Cooldown is per-position 

    /// Cooldown for one positionId must not affect a different positionId.
    function test_react_cooldown_isolatedPerPosition() public {
        bytes32 otherPositionId = keccak256("other-position");
        IReactive.LogRecord memory log1 = _makeLog(rsc.TOPIC_REBALANCE_NEEDED(), POSITION_ID);
        IReactive.LogRecord memory log2 = _makeLog(rsc.TOPIC_REBALANCE_NEEDED(), otherPositionId);

        rsc.react(log1); // stamps cooldown on POSITION_ID

        // Different positionId must still fire.
        vm.expectEmit(true, true, true, true, address(rsc));
        emit Callback(
            CHAIN_ID,
            DEPOSITOR_ADDR,
            CALLBACK_GAS_LIMIT,
            abi.encodeWithSignature("triggerRebalance(bytes32)", otherPositionId)
        );
        rsc.react(log2);
    }
}
