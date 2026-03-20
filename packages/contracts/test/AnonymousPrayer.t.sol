// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AnonymousPrayer} from "../src/AnonymousPrayer.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AnonymousPrayerTest is Test {
    AnonymousPrayer public prayer;

    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        prayer = new AnonymousPrayer();
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function testConstructorOwnerIsAuthorizedRecorder() public view {
        assertTrue(prayer.authorizedRecorders(owner));
    }

    function testConstructorCountIsZero() public view {
        assertEq(prayer.anonymousPrayerCount(), 0);
    }

    function testConstructorOwnerSetCorrectly() public view {
        assertEq(prayer.owner(), owner);
    }

    // =========================================================================
    // recordAnonymousPrayer - success
    // =========================================================================

    function testRecordAnonymousPrayerSuccess() public {
        bytes32 nullifier = keccak256("nullifier1");
        bytes32 messageHash = keccak256("prayer message");

        vm.expectEmit(true, false, false, true);
        emit AnonymousPrayer.AnonymousPrayerRecorded(nullifier, block.timestamp, messageHash);
        prayer.recordAnonymousPrayer(nullifier, messageHash);

        assertEq(prayer.anonymousPrayerCount(), 1);
        assertTrue(prayer.usedNullifiers(nullifier));
    }

    function testRecordAnonymousPrayerIncrementsCount() public {
        bytes32 nullifier1 = keccak256("nullifier1");
        bytes32 nullifier2 = keccak256("nullifier2");
        bytes32 messageHash = keccak256("prayer");

        prayer.recordAnonymousPrayer(nullifier1, messageHash);
        assertEq(prayer.anonymousPrayerCount(), 1);

        prayer.recordAnonymousPrayer(nullifier2, messageHash);
        assertEq(prayer.anonymousPrayerCount(), 2);
    }

    function testRecordAnonymousPrayerMarksNullifierUsed() public {
        bytes32 nullifier = keccak256("nullifier1");
        bytes32 messageHash = keccak256("prayer");

        assertFalse(prayer.usedNullifiers(nullifier));
        prayer.recordAnonymousPrayer(nullifier, messageHash);
        assertTrue(prayer.usedNullifiers(nullifier));
    }

    // =========================================================================
    // recordAnonymousPrayer - reverts
    // =========================================================================

    function testRecordAnonymousPrayerRevertsOnZeroNullifier() public {
        bytes32 messageHash = keccak256("prayer");

        vm.expectRevert(AnonymousPrayer.ZeroNullifier.selector);
        prayer.recordAnonymousPrayer(bytes32(0), messageHash);
    }

    function testRecordAnonymousPrayerRevertsOnDuplicateNullifier() public {
        bytes32 nullifier = keccak256("nullifier1");
        bytes32 messageHash = keccak256("prayer");

        prayer.recordAnonymousPrayer(nullifier, messageHash);

        vm.expectRevert(abi.encodeWithSelector(AnonymousPrayer.NullifierAlreadyUsed.selector, nullifier));
        prayer.recordAnonymousPrayer(nullifier, messageHash);
    }

    function testRecordAnonymousPrayerRevertsOnUnauthorizedCaller() public {
        bytes32 nullifier = keccak256("nullifier1");
        bytes32 messageHash = keccak256("prayer");

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(AnonymousPrayer.UnauthorizedRecorder.selector, user1));
        prayer.recordAnonymousPrayer(nullifier, messageHash);
    }

    // =========================================================================
    // isNullifierUsed
    // =========================================================================

    function testIsNullifierUsedReturnsFalseForUnused() public view {
        bytes32 nullifier = keccak256("unused");
        assertFalse(prayer.isNullifierUsed(nullifier));
    }

    function testIsNullifierUsedReturnsTrueForUsed() public {
        bytes32 nullifier = keccak256("used");
        bytes32 messageHash = keccak256("prayer");

        prayer.recordAnonymousPrayer(nullifier, messageHash);
        assertTrue(prayer.isNullifierUsed(nullifier));
    }

    // =========================================================================
    // setRecorder
    // =========================================================================

    function testSetRecorderAuthorizeNewRecorder() public {
        assertFalse(prayer.authorizedRecorders(user1));
        prayer.setRecorder(user1, true);
        assertTrue(prayer.authorizedRecorders(user1));
    }

    function testSetRecorderAuthorizedRecorderCanRecord() public {
        prayer.setRecorder(user1, true);

        bytes32 nullifier = keccak256("nullifier1");
        bytes32 messageHash = keccak256("prayer");

        vm.prank(user1);
        prayer.recordAnonymousPrayer(nullifier, messageHash);

        assertEq(prayer.anonymousPrayerCount(), 1);
    }

    function testSetRecorderDeauthorizeRecorder() public {
        prayer.setRecorder(user1, true);
        assertTrue(prayer.authorizedRecorders(user1));

        prayer.setRecorder(user1, false);
        assertFalse(prayer.authorizedRecorders(user1));

        bytes32 nullifier = keccak256("nullifier1");
        bytes32 messageHash = keccak256("prayer");

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(AnonymousPrayer.UnauthorizedRecorder.selector, user1));
        prayer.recordAnonymousPrayer(nullifier, messageHash);
    }

    function testSetRecorderRevertsForNonOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        prayer.setRecorder(user2, true);
    }

    // =========================================================================
    // Multiple prayers from different recorders
    // =========================================================================

    function testMultiplePrayersFromDifferentRecorders() public {
        prayer.setRecorder(user1, true);
        prayer.setRecorder(user2, true);

        bytes32 nullifier1 = keccak256("nullifier1");
        bytes32 nullifier2 = keccak256("nullifier2");
        bytes32 nullifier3 = keccak256("nullifier3");
        bytes32 messageHash = keccak256("prayer");

        // Owner records
        prayer.recordAnonymousPrayer(nullifier1, messageHash);

        // user1 records
        vm.prank(user1);
        prayer.recordAnonymousPrayer(nullifier2, messageHash);

        // user2 records
        vm.prank(user2);
        prayer.recordAnonymousPrayer(nullifier3, messageHash);

        assertEq(prayer.anonymousPrayerCount(), 3);
        assertTrue(prayer.isNullifierUsed(nullifier1));
        assertTrue(prayer.isNullifierUsed(nullifier2));
        assertTrue(prayer.isNullifierUsed(nullifier3));
    }
}
