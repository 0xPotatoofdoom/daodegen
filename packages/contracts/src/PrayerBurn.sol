// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PrayerBurn
/// @notice Burn DAODEGEN tokens as prayers. Standalone contract -- does not modify the Jar.
/// @dev Optionally triggers Jar fee distribution when conditions are met.
///      The Jar's release() is permissionless; PrayerBurn calls it as a convenience.
///      For auto-release to work, either: (a) Jar burnAmount is 0, or
///      (b) this contract holds DAODEGEN and has approved the Jar (call approveJar()).

interface IDaoDeGenJar {
    // Currency is `type Currency is address` in v4-core — same ABI encoding as address.
    // We declare it as address here to avoid importing the user-defined type.
    function release(address[] calldata assets) external;
    function burnAmount() external view returns (uint256);
}

interface ISermonCommitment {
    function createCommitment(address supplicant, uint256 burnAmount) external returns (bytes32 id);
}

contract PrayerBurn is Ownable, ReentrancyGuard {
    // --- Events ---
    event Prayer(address indexed sender, uint256 amount, bytes message);
    event PrayerBurned(address indexed sender, uint256 amount, bytes32 commitmentId);

    // --- Errors ---
    error InsufficientBurn(uint256 sent, uint256 minimum);
    error MessageTooLong(uint256 length, uint256 maximum);
    error PatienceIsAVirtue(uint256 nextPrayerAt);
    error ZeroAddress();

    // --- Immutables ---
    ERC20Burnable public immutable daodegen;
    IDaoDeGenJar public immutable jar;

    // --- Configuration (admin-adjustable) ---
    uint256 public minimumBurn;
    uint256 public cooldownPeriod;
    uint256 public releaseThreshold; // 0 = auto-release disabled
    ISermonCommitment public sermonCommitment; // optional escrow integration

    // --- Constants ---
    uint256 public constant MAX_MESSAGE_LENGTH = 1024;

    // --- Counters ---
    uint256 public prayerCount;
    uint256 public totalBurned;

    // --- Per-address state ---
    mapping(address => uint256) public lastPrayer;

    constructor(
        address _token,
        address _jar,
        uint256 _minimumBurn,
        uint256 _cooldownPeriod
    ) Ownable(msg.sender) {
        if (_token == address(0) || _jar == address(0)) revert ZeroAddress();
        daodegen = ERC20Burnable(_token);
        jar = IDaoDeGenJar(_jar);
        minimumBurn = _minimumBurn;
        cooldownPeriod = _cooldownPeriod;
    }

    /// @notice Burn DAODEGEN tokens with an attached message.
    /// @param amount Number of tokens to burn (must be >= minimumBurn).
    /// @param message The prayer (can be empty for silent burns). Max 1024 bytes.
    function pray(uint256 amount, bytes calldata message) external nonReentrant {
        if (amount < minimumBurn) revert InsufficientBurn(amount, minimumBurn);
        if (message.length > MAX_MESSAGE_LENGTH) {
            revert MessageTooLong(message.length, MAX_MESSAGE_LENGTH);
        }

        uint256 last = lastPrayer[msg.sender];
        if (last != 0) {
            uint256 nextAllowed = last + cooldownPeriod;
            if (block.timestamp < nextAllowed) {
                revert PatienceIsAVirtue(nextAllowed);
            }
        }

        lastPrayer[msg.sender] = block.timestamp;
        prayerCount++;
        totalBurned += amount;

        daodegen.burnFrom(msg.sender, amount);

        emit Prayer(msg.sender, amount, message);

        // Create sermon commitment if escrow is configured.
        // Non-fatal: if SermonCommitment reverts for any reason, burn proceeds without escrow.
        // When sermonCommitment is not configured, commitmentId remains bytes32(0).
        bytes32 commitmentId;
        if (address(sermonCommitment) != address(0)) {
            try sermonCommitment.createCommitment(msg.sender, amount) returns (bytes32 id) {
                commitmentId = id;
            } catch {
                // SermonCommitment failure is non-fatal — burn proceeds, commitment skipped
            }
        }
        emit PrayerBurned(msg.sender, amount, commitmentId);

        _tryRelease();
    }

    // --- Release integration ---

    /// @dev Best-effort trigger of Jar fee distribution. Silently returns if
    ///      any condition isn't met (threshold, jar balance, burn funding).
    ///
    /// NOTE: We intentionally do NOT call jar.outstanding() here.
    ///       outstanding() takes a Currency (user-defined v4-core type) and reverts
    ///       when called from an interface that declares it as plain address, causing
    ///       the try/catch to silently abort. Instead we compare raw ETH balance to
    ///       releaseThreshold directly — slightly optimistic (may include unclaimed
    ///       ETH), but safe: release() is idempotent and distributes whatever is
    ///       available at call time.
    function _tryRelease() internal {
        if (releaseThreshold == 0) return;

        // Check raw ETH balance in jar against threshold
        if (address(jar).balance < releaseThreshold) return;

        // Check if this contract can cover jar's burn cost
        try jar.burnAmount() returns (uint256 cost) {
            if (cost > 0 && daodegen.balanceOf(address(this)) < cost) return;
        } catch {
            return;
        }

        // Attempt release — non-fatal if it fails
        address[] memory assets = new address[](1);
        assets[0] = address(0);
        // slither-disable-next-line low-level-calls
        try jar.release(assets) {} catch {} // best-effort: release failure is non-fatal
    }

    /// @notice Approve the Jar to spend this contract's DAODEGEN for release burns.
    ///         Call after funding this contract with DAODEGEN tokens.
    function approveJar() external onlyOwner {
        daodegen.approve(address(jar), type(uint256).max);
    }

    // --- Admin ---

    function setMinimumBurn(uint256 _minimumBurn) external onlyOwner {
        minimumBurn = _minimumBurn;
    }

    function setCooldownPeriod(uint256 _cooldownPeriod) external onlyOwner {
        cooldownPeriod = _cooldownPeriod;
    }

    function setReleaseThreshold(uint256 _releaseThreshold) external onlyOwner {
        releaseThreshold = _releaseThreshold;
    }

    function setSermonCommitment(address _sermonCommitment) external onlyOwner {
        sermonCommitment = ISermonCommitment(_sermonCommitment);
    }
}
