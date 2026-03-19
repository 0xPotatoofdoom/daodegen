// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title SermonCommitment
/// @notice On-chain commitment registry for sermon delivery after a DAODEGEN burn.
/// @dev Trust model: tokens are burned (not escrowed) in PrayerBurn. This contract
///      tracks commitments and enforces a fulfillment window. The pastor must post
///      a wisdom hash before the deadline. If the deadline passes unfulfilled,
///      anyone can mark the commitment as refundable — signaling off-chain systems
///      (the frontend / indexer) to compensate the supplicant.
///
///      This contract does NOT hold funds. "Refund" means the commitment is marked
///      failed, which off-chain systems use to trigger compensation. The on-chain
///      guarantee is: a commitment is either fulfilled on time OR marked refundable.
///      It can never be both, and it can never be silently abandoned.

contract SermonCommitment {
    // --- Constants ---
    uint256 public constant FULFILLMENT_WINDOW = 300; // ~5 min on Unichain

    // --- State ---
    address public pastor;
    address public owner;
    address public pendingOwner;
    address public trustedCaller;
    uint256 private _nonce;

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
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Errors ---
    error OnlyPastor();
    error OnlyOwner();
    error OnlyTrustedCaller();
    error CommitmentNotFound();
    error AlreadyFulfilled();
    error AlreadyRefunded();
    error FulfillmentWindowExpired();
    error DeadlineNotReached();
    error ZeroAddress();
    error OnlyPendingOwner();

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
        id = keccak256(abi.encodePacked(supplicant, burnAmount, block.timestamp, _nonce++));
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
    /// @dev Must be called before the deadline. After expiry the commitment can
    ///      only be refunded — this eliminates the race between fulfill and refund.
    /// @param commitmentId The commitment to fulfill.
    /// @param wisdomHash keccak256 of the sermon text.
    function fulfill(bytes32 commitmentId, bytes32 wisdomHash) external {
        if (msg.sender != pastor) revert OnlyPastor();

        Commitment storage c = commitments[commitmentId];
        if (c.supplicant == address(0)) revert CommitmentNotFound();
        if (c.fulfilled) revert AlreadyFulfilled();
        if (c.refunded) revert AlreadyRefunded();
        if (block.timestamp >= c.deadline) revert FulfillmentWindowExpired();

        c.wisdomHash = wisdomHash;
        c.fulfilled = true;

        emit CommitmentFulfilled(commitmentId, wisdomHash, pastor);
    }

    /// @notice Mark an expired, unfulfilled commitment as refundable.
    /// @dev Callable by anyone — permissionless to ensure no commitment can be
    ///      silently abandoned. Does not transfer funds (tokens were burned);
    ///      the refunded flag signals off-chain systems to compensate the supplicant.
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

    /// @notice Initiate ownership transfer to a new address (two-step).
    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    /// @notice Accept ownership transfer. Must be called by the pending owner.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert OnlyPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
