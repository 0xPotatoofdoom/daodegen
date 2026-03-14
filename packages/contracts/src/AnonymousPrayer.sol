// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AnonymousPrayer
/// @notice Records privacy-attested prayers without linking wallet identity.
/// @dev Self Protocol's IdentityVerificationHub V2 currently deploys on Celo.
///      When Hub V2 is deployed to Unichain (or via Hyperlane cross-chain
///      verification), this contract can inherit SelfVerificationRoot and
///      perform full on-chain ZK verification. Until then, the backend
///      verifies Self proofs off-chain via SelfBackendVerifier, and this
///      contract records the resulting anonymous prayer with a nullifier
///      to prevent double-use of proofs.
///
///      Architecture:
///        1. User scans passport/ID with Self mobile app
///        2. Self app generates ZK proof (zk-SNARK) proving burn eligibility
///        3. Backend verifies proof via SelfBackendVerifier
///        4. Backend calls recordAnonymousPrayer() with the nullifier
///        5. Prayer is recorded without any link to the user's wallet

contract AnonymousPrayer is Ownable {
    // --- Events ---
    event AnonymousPrayerRecorded(
        bytes32 indexed nullifier,
        uint256 timestamp,
        bytes32 messageHash
    );

    // --- Errors ---
    error NullifierAlreadyUsed(bytes32 nullifier);
    error ZeroNullifier();
    error UnauthorizedRecorder(address caller);

    // --- State ---
    /// @notice Set of used nullifiers to prevent proof replay
    mapping(bytes32 => bool) public usedNullifiers;

    /// @notice Addresses authorized to record anonymous prayers (backend relayers)
    mapping(address => bool) public authorizedRecorders;

    /// @notice Total anonymous prayers recorded
    uint256 public anonymousPrayerCount;

    constructor() Ownable(msg.sender) {
        authorizedRecorders[msg.sender] = true;
    }

    /// @notice Record an anonymous prayer after off-chain Self proof verification.
    /// @param nullifier The unique nullifier from the Self ZK proof (prevents replay)
    /// @param messageHash keccak256 hash of the prayer message (content stays off-chain)
    function recordAnonymousPrayer(
        bytes32 nullifier,
        bytes32 messageHash
    ) external {
        if (!authorizedRecorders[msg.sender]) {
            revert UnauthorizedRecorder(msg.sender);
        }
        if (nullifier == bytes32(0)) revert ZeroNullifier();
        if (usedNullifiers[nullifier]) {
            revert NullifierAlreadyUsed(nullifier);
        }

        usedNullifiers[nullifier] = true;
        anonymousPrayerCount++;

        emit AnonymousPrayerRecorded(nullifier, block.timestamp, messageHash);
    }

    /// @notice Check if a nullifier has already been used
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return usedNullifiers[nullifier];
    }

    // --- Admin ---

    function setRecorder(address recorder, bool authorized) external onlyOwner {
        authorizedRecorders[recorder] = authorized;
    }
}
