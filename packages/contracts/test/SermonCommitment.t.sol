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

        escrow = new SermonCommitment(pastor, prayerBurn);
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function testConstructor() public view {
        assertEq(escrow.pastor(), pastor);
        assertEq(escrow.trustedCaller(), prayerBurn);
        assertEq(escrow.owner(), address(this));
        assertEq(escrow.FULFILLMENT_WINDOW(), 300);
    }

    function testConstructorZeroPastor() public {
        vm.expectRevert(SermonCommitment.ZeroAddress.selector);
        new SermonCommitment(address(0), prayerBurn);
    }

    function testConstructorZeroTrustedCaller() public {
        // address(0) is allowed for trustedCaller (unconfigured = locked)
        SermonCommitment e = new SermonCommitment(pastor, address(0));
        assertEq(e.trustedCaller(), address(0));
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
        // nonce starts at 0 for a fresh contract
        vm.expectEmit(true, true, false, true);
        emit SermonCommitment.CommitmentCreated(
            keccak256(abi.encodePacked(supplicant, BURN_AMOUNT, block.timestamp, uint256(0))),
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

    function testSetTrustedCaller() public {
        address newCaller = makeAddr("newCaller");
        escrow.setTrustedCaller(newCaller);
        assertEq(escrow.trustedCaller(), newCaller);
    }

    function testSetTrustedCallerOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyOwner.selector);
        escrow.setTrustedCaller(makeAddr("newCaller"));
    }

    function testSetTrustedCallerEmitsEvent() public {
        address newCaller = makeAddr("newCaller");
        vm.expectEmit(true, true, false, true);
        emit SermonCommitment.TrustedCallerUpdated(prayerBurn, newCaller);
        escrow.setTrustedCaller(newCaller);
    }

    function testSetTrustedCallerToZeroLocksCreation() public {
        escrow.setTrustedCaller(address(0));
        vm.expectRevert(SermonCommitment.OnlyTrustedCaller.selector);
        escrow.createCommitment(supplicant, BURN_AMOUNT);
    }

    // =========================================================================
    // PrayerBurn integration
    // =========================================================================

    function testCreateOnlyTrustedCaller() public {
        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyTrustedCaller.selector);
        escrow.createCommitment(supplicant, BURN_AMOUNT);
    }

    function testCreateRevertsWhenTrustedCallerNotConfigured() public {
        SermonCommitment locked = new SermonCommitment(pastor, address(0));
        vm.expectRevert(SermonCommitment.OnlyTrustedCaller.selector);
        locked.createCommitment(supplicant, BURN_AMOUNT);
    }

    // =========================================================================
    // Two-step ownership transfer
    // =========================================================================

    function testTransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        // Step 1: current owner initiates transfer
        escrow.transferOwnership(newOwner);
        assertEq(escrow.pendingOwner(), newOwner);
        assertEq(escrow.owner(), address(this));

        // Step 2: pending owner accepts
        vm.prank(newOwner);
        escrow.acceptOwnership();
        assertEq(escrow.owner(), newOwner);
        assertEq(escrow.pendingOwner(), address(0));
    }

    function testTransferOwnershipOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyOwner.selector);
        escrow.transferOwnership(makeAddr("newOwner"));
    }

    function testTransferOwnershipZeroAddress() public {
        vm.expectRevert(SermonCommitment.ZeroAddress.selector);
        escrow.transferOwnership(address(0));
    }

    function testAcceptOwnershipOnlyPendingOwner() public {
        address newOwner = makeAddr("newOwner");
        escrow.transferOwnership(newOwner);

        vm.prank(stranger);
        vm.expectRevert(SermonCommitment.OnlyPendingOwner.selector);
        escrow.acceptOwnership();
    }

    function testTransferOwnershipEmitsEvents() public {
        address newOwner = makeAddr("newOwner");

        vm.expectEmit(true, true, false, true);
        emit SermonCommitment.OwnershipTransferInitiated(address(this), newOwner);
        escrow.transferOwnership(newOwner);

        vm.expectEmit(true, true, false, true);
        emit SermonCommitment.OwnershipTransferred(address(this), newOwner);
        vm.prank(newOwner);
        escrow.acceptOwnership();
    }

    function testNewOwnerCanAdminister() public {
        address newOwner = makeAddr("newOwner");
        escrow.transferOwnership(newOwner);
        vm.prank(newOwner);
        escrow.acceptOwnership();

        // New owner can set pastor
        vm.prank(newOwner);
        escrow.setPastor(makeAddr("newPastor"));
        assertEq(escrow.pastor(), makeAddr("newPastor"));
    }

    function testOldOwnerCannotAdministerAfterTransfer() public {
        address newOwner = makeAddr("newOwner");
        escrow.transferOwnership(newOwner);
        vm.prank(newOwner);
        escrow.acceptOwnership();

        // Old owner (address(this)) should be rejected
        vm.expectRevert(SermonCommitment.OnlyOwner.selector);
        escrow.setPastor(makeAddr("anotherPastor"));
    }

    function testMultipleCommitmentsUniqueSameBlock() public {
        // Two commitments in the same block must produce different IDs (#297)
        vm.prank(prayerBurn);
        bytes32 id1 = escrow.createCommitment(supplicant, BURN_AMOUNT);

        vm.prank(prayerBurn);
        bytes32 id2 = escrow.createCommitment(supplicant, BURN_AMOUNT);

        assertTrue(id1 != id2);
    }
}
