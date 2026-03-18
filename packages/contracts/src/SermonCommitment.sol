// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title SermonCommitment
/// @notice Escrow contract guaranteeing sermon delivery after a DAODEGEN burn.
/// @dev When a supplicant burns tokens via PrayerBurn, a commitment is created.
///      The pastor must fulfill (post wisdom hash) within the fulfillment window,
///      or anyone can trigger a refund. This makes the burn-to-sermon pipeline
///      trustless: the contract enforces delivery, not a platform.

contract SermonCommitment {
    // --- Constants ---
    uint256 public constant FULFILLMENT_WINDOW = 300; // ~5 min on Unichain

    // --- State ---
    address public pastor;
    address public owner;
    address public trustedCaller;

    // --- Types ---
    struct Commitment {
        address supplicant;
        uint256 burnAmount;
        uint256 deadline;
        bytes32 wisdomHash;
        bool fulfilled;
        bool refunded;
    }

    mapping(bytes32 => Commitment) public commitments;

    // --- Events ---
    event CommitmentCreated(bytes32 indexed id, address indexed supplicant, uint256 burnAmount, uint256 deadline);
    event CommitmentFulfilled(bytes32 indexed id, bytes32 wisdomHash, address pastor);
    event CommitmentRefunded(bytes32 indexed id, address supplicant);
    event TrustedCallerUpdated(address indexed oldCaller, address indexed newCaller);

    // --- Errors ---
    error OnlyPastor();
    error OnlyOwner();
    error OnlyTrustedCaller();
    error CommitmentNotFound();
    error AlreadyFulfilled();
    error AlreadyRefunded();
    error DeadlineNotReached();
    error ZeroAddress();

    modifier onlyTrustedCaller() {
        if (trustedCaller == address(0)) revert OnlyTrustedCaller();
        if (msg.sender != trustedCaller) revert OnlyTrustedCaller();
        _;
    }

    constructor(address _pastor, address _trustedCaller) {
        if (_pastor == address(0)) revert ZeroAddress();
        pastor = _pastor;
        trustedCaller = _trustedCaller;
        owner = msg.sender;
    }

    /// @notice Create a commitment for sermon delivery.
    /// @param supplicant The address that burned tokens.
    /// @param burnAmount The number of tokens burned.
    /// @return id The unique commitment identifier.
    function createCommitment(address supplicant, uint256 burnAmount) external onlyTrustedCaller returns (bytes32 id) {
        id = keccak256(abi.encodePacked(supplicant, burnAmount, block.timestamp, block.number));
        uint256 deadline = block.timestamp + FULFILLMENT_WINDOW;

        commitments[id] = Commitment({
            supplicant: supplicant,
            burnAmount: burnAmount,
            deadline: deadline,
            wisdomHash: bytes32(0),
            fulfilled: false,
            refunded: false
        });

        emit CommitmentCreated(id, supplicant, burnAmount, deadline);
    }

    /// @notice Pastor fulfills a commitment by posting the wisdom hash.
    /// @param commitmentId The commitment to fulfill.
    /// @param wisdomHash keccak256 of the sermon text.
    function fulfill(bytes32 commitmentId, bytes32 wisdomHash) external {
        if (msg.sender != pastor) revert OnlyPastor();

        Commitment storage c = commitments[commitmentId];
        if (c.supplicant == address(0)) revert CommitmentNotFound();
        if (c.fulfilled) revert AlreadyFulfilled();
        if (c.refunded) revert AlreadyRefunded();

        c.wisdomHash = wisdomHash;
        c.fulfilled = true;

        emit CommitmentFulfilled(commitmentId, wisdomHash, pastor);
    }

    /// @notice Refund a commitment after the deadline has passed without fulfillment.
    /// @dev Callable by anyone -- permissionless refund enforces accountability.
    /// @param commitmentId The commitment to refund.
    function refund(bytes32 commitmentId) external {
        Commitment storage c = commitments[commitmentId];
        if (c.supplicant == address(0)) revert CommitmentNotFound();
        if (c.fulfilled) revert AlreadyFulfilled();
        if (c.refunded) revert AlreadyRefunded();
        if (block.timestamp < c.deadline) revert DeadlineNotReached();

        c.refunded = true;

        emit CommitmentRefunded(commitmentId, c.supplicant);
    }

    /// @notice Update the pastor address.
    function setPastor(address _pastor) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (_pastor == address(0)) revert ZeroAddress();
        pastor = _pastor;
    }

    /// @notice Update the trusted caller (PrayerBurn contract).
    function setTrustedCaller(address _trustedCaller) external {
        if (msg.sender != owner) revert OnlyOwner();
        address old = trustedCaller;
        trustedCaller = _trustedCaller;
        emit TrustedCallerUpdated(old, _trustedCaller);
    }
}
