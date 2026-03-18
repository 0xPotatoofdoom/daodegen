// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {SermonCommitment} from "../src/SermonCommitment.sol";

contract SermonCommitmentTest is Test {
    SermonCommitment public escrow;

    address public pastor;
    address public prayerBurn;
    address public supplicant;
    address public stranger;

    uint256 constant BURN_AMOUNT = 100e18;

    function setUp() public {
        pastor = makeAddr("pastor");
        prayerBurn = makeAddr("prayerBurn");
        supplicant = makeAddr("supplicant");
        stranger = makeAddr("stranger");

        escrow = new SermonCommitment(pastor);
        escrow.setPrayerBurn(prayerBurn);
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function testConstructor() public view {
        assertEq(escrow.pastor(), pastor);
        assertEq(escrow.owner(), address(this));
        assertEq(escrow.FULFILLMENT_WINDOW(), 300);
    }

    function testConstructorZeroPastor() public {
        vm.expectRevert(SermonCommitment.ZeroAddress.selector);
        new SermonCommitment(address(0));
    }

    // =========================================================================
    // Create + Fulfill within window (success path)
    // =========================================================================

    function testCreateThenFulfill() public {
        // Create commitment
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);

        // Verify commitment stored
        (address s, uint256 amt, uint256 deadline, bytes32 wh, bool fulfilled, bool refunded) =
            escrow.commitments(id);
        assertEq(s, supplicant);
        assertEq(amt, BURN_AMOUNT);
        assertEq(deadline, block.timestamp + 300);
        assertEq(wh, bytes32(0));
        assertFalse(fulfilled);
        assertFalse(refunded);

        // Fulfill within window
        bytes32 wisdomHash = keccak256("The Tao that can be forked is not the eternal Tao");
        vm.prank(pastor);
        escrow.fulfill(id, wisdomHash);

        // Verify fulfillment
        (, , , bytes32 storedHash, bool isFulfilled,) = escrow.commitments(id);
        assertEq(storedHash, wisdomHash);
        assertTrue(isFulfilled);
    }

    function testCreateEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit SermonCommitment.CommitmentCreated(
            keccak256(abi.encodePacked(supplicant, BURN_AMOUNT, block.timestamp, block.number)),
            supplicant,
            BURN_AMOUNT,
            block.timestamp + 300
        );
        vm.prank(prayerBurn);
        escrow.createCommitment(supplicant, BURN_AMOUNT);
    }

    function testFulfillEmitsEvent() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);
        bytes32 wisdomHash = keccak256("wisdom");

        vm.expectEmit(true, false, false, true);
        emit SermonCommitment.CommitmentFulfilled(id, wisdomHash, pastor);

        vm.prank(pastor);
        escrow.fulfill(id, wisdomHash);
    }

    // =========================================================================
    // Create + Wait past deadline + Refund (success path)
    // =========================================================================

    function testCreateThenRefundAfterDeadline() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);

        // Warp past the deadline
        vm.warp(block.timestamp + 301);

        // Anyone can refund
        vm.prank(stranger);
        escrow.refund(id);

        // Verify refund
        (, , , , bool fulfilled, bool refunded) = escrow.commitments(id);
        assertFalse(fulfilled);
        assertTrue(refunded);
    }

    function testRefundEmitsEvent() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);
        vm.warp(block.timestamp + 301);

        vm.expectEmit(true, false, false, true);
        emit SermonCommitment.CommitmentRefunded(id, supplicant);

        escrow.refund(id);
    }

    function testRefundAtExactDeadline() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);

        // Warp to exactly the deadline
        vm.warp(block.timestamp + 300);

        // Should succeed -- deadline check is <, not <=
        escrow.refund(id);

        (, , , , , bool refunded) = escrow.commitments(id);
        assertTrue(refunded);
    }

    // =========================================================================
    // Only prayerBurn can create commitments
    // =========================================================================

    function testCreateOnlyPrayerBurn() public {
        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyPrayerBurn.selector);
        escrow.createCommitment(supplicant, BURN_AMOUNT);

        vm.prank(supplicant);
        vm.expectRevert(SermonCommitment.OnlyPrayerBurn.selector);
        escrow.createCommitment(supplicant, BURN_AMOUNT);
    }

    // =========================================================================
    // Only pastor can fulfill
    // =========================================================================

    function testFulfillOnlyPastor() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);
        bytes32 wisdomHash = keccak256("wisdom");

        vm.prank(supplicant);
        vm.expectRevert(SermonCommitment.OnlyPastor.selector);
        escrow.fulfill(id, wisdomHash);

        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyPastor.selector);
        escrow.fulfill(id, wisdomHash);
    }

    // =========================================================================
    // Cannot fulfill twice
    // =========================================================================

    function testCannotFulfillTwice() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);
        bytes32 wisdomHash = keccak256("wisdom");

        vm.prank(pastor);
        escrow.fulfill(id, wisdomHash);

        vm.prank(pastor);
        vm.expectRevert(SermonCommitment.AlreadyFulfilled.selector);
        escrow.fulfill(id, keccak256("different wisdom"));
    }

    // =========================================================================
    // Cannot refund before deadline
    // =========================================================================

    function testCannotRefundBeforeDeadline() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);

        // Still within the window
        vm.warp(block.timestamp + 100);

        vm.expectRevert(SermonCommitment.DeadlineNotReached.selector);
        escrow.refund(id);
    }

    // =========================================================================
    // Edge cases
    // =========================================================================

    function testCannotRefundFulfilledCommitment() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);

        vm.prank(pastor);
        escrow.fulfill(id, keccak256("wisdom"));

        vm.warp(block.timestamp + 301);
        vm.expectRevert(SermonCommitment.AlreadyFulfilled.selector);
        escrow.refund(id);
    }

    function testCannotRefundTwice() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);
        vm.warp(block.timestamp + 301);
        escrow.refund(id);

        vm.expectRevert(SermonCommitment.AlreadyRefunded.selector);
        escrow.refund(id);
    }

    function testCannotFulfillRefundedCommitment() public {
        vm.prank(prayerBurn);
        bytes32 id = escrow.createCommitment(supplicant, BURN_AMOUNT);
        vm.warp(block.timestamp + 301);
        escrow.refund(id);

        vm.prank(pastor);
        vm.expectRevert(SermonCommitment.AlreadyRefunded.selector);
        escrow.fulfill(id, keccak256("too late"));
    }

    function testFulfillNonexistentCommitment() public {
        vm.prank(pastor);
        vm.expectRevert(SermonCommitment.CommitmentNotFound.selector);
        escrow.fulfill(bytes32(uint256(999)), keccak256("ghost"));
    }

    function testRefundNonexistentCommitment() public {
        vm.expectRevert(SermonCommitment.CommitmentNotFound.selector);
        escrow.refund(bytes32(uint256(999)));
    }

    // =========================================================================
    // Admin
    // =========================================================================

    function testSetPastor() public {
        address newPastor = makeAddr("newPastor");
        escrow.setPastor(newPastor);
        assertEq(escrow.pastor(), newPastor);
    }

    function testSetPastorOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyOwner.selector);
        escrow.setPastor(makeAddr("newPastor"));
    }

    function testSetPastorZeroAddress() public {
        vm.expectRevert(SermonCommitment.ZeroAddress.selector);
        escrow.setPastor(address(0));
    }

    function testSetPrayerBurn() public {
        address newPrayerBurn = makeAddr("newPrayerBurn");
        escrow.setPrayerBurn(newPrayerBurn);
        assertEq(escrow.prayerBurn(), newPrayerBurn);
    }

    function testSetPrayerBurnOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyOwner.selector);
        escrow.setPrayerBurn(makeAddr("newPrayerBurn"));
    }

    function testSetPrayerBurnZeroAddress() public {
        vm.expectRevert(SermonCommitment.ZeroAddress.selector);
        escrow.setPrayerBurn(address(0));
    }

    // =========================================================================
    // PrayerBurn integration
    // =========================================================================

    function testMultipleCommitmentsUnique() public {
        vm.prank(prayerBurn);
        bytes32 id1 = escrow.createCommitment(supplicant, BURN_AMOUNT);

        // Advance block to ensure different id
        vm.roll(block.number + 1);
        vm.prank(prayerBurn);
        bytes32 id2 = escrow.createCommitment(supplicant, BURN_AMOUNT);

        assertTrue(id1 != id2);
    }
}
