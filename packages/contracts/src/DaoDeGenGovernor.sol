// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/// @title DaoDeGenGovernor
/// @notice OZ Governor for the Council of 81 — VerseNFT-weighted voting with dual proposal thresholds.
/// @dev STATUS: STUB — not deployed. Interim governance uses Snapshot (off-chain signaling) +
///      Gnosis Safe (trusted execution). Deploy when transitioning to fully on-chain governance.
///
///      Architecture:
///        Voting token : WrappedVerseNFT (ERC-721Votes wrapping VerseNFT, 1 wVERSE = 1 vote, max 81)
///        Thresholds   : SimpleMajority (41 for-votes) | Supermajority (55 for-votes)
///        Timelock     : 24 h default; owner can raise to 48 h via TimelockController.updateDelay()
///        Proposal gate: proposer must hold >= 1 wVERSE (proposalThreshold)
///
///      Proposal types and their required thresholds:
///        MinBurnAmount      → Simple majority (41)   — governs PrayerBurn.setBurnAmount()
///        TreasuryAllocation → Simple majority (41)   — governs DaoDeGenJar treasury spend
///        PastorPromptUpdate → Supermajority  (55)    — governs AI Pastor system prompt
///        ModelSelection     → Supermajority  (55)    — governs LLM provider / model switch
///
///      Deployment checklist (when ready):
///        1. Deploy WrappedVerseNFT(verseNFT address)
///        2. Coordinate wrap + delegate for all active NFT holders
///        3. Deploy TimelockController(minDelay=86400, proposers=[], executors=[address(0)], admin=deployer)
///        4. Deploy DaoDeGenGovernor(wrappedVerseNFT, timelockController)
///        5. Grant TimelockController PROPOSER_ROLE to Governor address
///        6. Grant TimelockController EXECUTOR_ROLE to address(0) (anyone can execute passed proposals)
///        7. Renounce TimelockController admin role from deployer
///        8. Transfer ownership of PrayerBurn and DaoDeGenJar to TimelockController address
contract DaoDeGenGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorTimelockControl {
    // -------------------------------------------------------------------------
    // Proposal types and thresholds
    // -------------------------------------------------------------------------

    enum ProposalType {
        MinBurnAmount,       // Simple majority: 41 for-votes required
        TreasuryAllocation,  // Simple majority: 41 for-votes required
        PastorPromptUpdate,  // Supermajority:   55 for-votes required
        ModelSelection       // Supermajority:   55 for-votes required
    }

    uint256 public constant SIMPLE_MAJORITY_THRESHOLD = 41;
    uint256 public constant SUPERMAJORITY_THRESHOLD   = 55;

    mapping(uint256 proposalId => ProposalType) public proposalTypes;

    event ProposalTypeSet(uint256 indexed proposalId, ProposalType proposalType);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(IVotes wrappedVerseNFT, TimelockController timelockController)
        Governor("DaoDeGenGovernor")
        GovernorSettings(
            1,       // votingDelay:        1 block  (~2 s on Unichain)
            302_400, // votingPeriod:       ~7 days  at 2 s/block
            1        // proposalThreshold:  >= 1 wVERSE to propose
        )
        GovernorVotes(wrappedVerseNFT)
        GovernorTimelockControl(timelockController)
    {}

    // -------------------------------------------------------------------------
    // Proposal entry point with type tagging
    // -------------------------------------------------------------------------

    /// @notice Disabled. All proposals must be submitted via proposeWithType() to ensure
    ///         the correct threshold is applied. Calling this reverts.
    function propose(
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        string memory
    ) public pure override returns (uint256) {
        revert("DaoDeGenGovernor: use proposeWithType");
    }

    /// @notice Submit a proposal tagged with a type that determines the passing threshold.
    /// @dev Bypasses the disabled propose() by calling _propose() directly.
    ///      Caller must hold >= proposalThreshold() wVERSE tokens (self-delegated).
    ///      Proposal lifecycle: Pending → Active (votingPeriod) → Succeeded/Defeated → Queued → Executed
    function proposeWithType(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType
    ) external returns (uint256 proposalId) {
        proposalId = _propose(targets, values, calldatas, description, _msgSender());
        proposalTypes[proposalId] = proposalType;
        emit ProposalTypeSet(proposalId, proposalType);
    }

    // -------------------------------------------------------------------------
    // Dual-threshold vote success logic
    // -------------------------------------------------------------------------

    /// @dev Returns the required for-vote count based on the proposal's type.
    function _requiredForVotes(uint256 proposalId) internal view returns (uint256) {
        ProposalType pType = proposalTypes[proposalId];
        if (pType == ProposalType.PastorPromptUpdate || pType == ProposalType.ModelSelection) {
            return SUPERMAJORITY_THRESHOLD;
        }
        return SIMPLE_MAJORITY_THRESHOLD;
    }

    /// @inheritdoc GovernorCountingSimple
    /// @dev Overrides the default "forVotes > againstVotes" check with an absolute threshold.
    ///      For-votes must reach the threshold set by the proposal's type.
    ///      Abstain votes count toward quorum (_quorumReached) but not toward _voteSucceeded.
    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCountingSimple)
        returns (bool)
    {
        (, uint256 forVotes,) = proposalVotes(proposalId);
        return forVotes >= _requiredForVotes(proposalId);
    }

    /// @inheritdoc Governor
    /// @dev Returns SIMPLE_MAJORITY_THRESHOLD as the base quorum for all proposals.
    ///      Supermajority enforcement is handled in _voteSucceeded, not here, because
    ///      quorum() is type-agnostic (called before the proposal type is resolvable in some paths).
    function quorum(uint256 /* timepoint */) public pure override returns (uint256) {
        return SIMPLE_MAJORITY_THRESHOLD;
    }

    // -------------------------------------------------------------------------
    // Required OZ overrides (multiple inheritance resolution)
    // -------------------------------------------------------------------------

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
}
