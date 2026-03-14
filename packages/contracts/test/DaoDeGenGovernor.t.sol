// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {DaoDeGenGovernor} from "../src/DaoDeGenGovernor.sol";
import {WrappedVerseNFT} from "../src/WrappedVerseNFT.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

// Covers core dual-threshold logic, propose() revert guard, and full queue/execute/cancel lifecycle.

contract DaoDeGenGovernorTest is Test {
    VerseNFT nft;
    WrappedVerseNFT wrapped;
    TimelockController timelock;
    DaoDeGenGovernor governor;

    // 3 representative holders
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    address carol = address(0xCAB01);

    function setUp() public {
        // Deploy NFT and wrapper
        nft = new VerseNFT("ipfs://test", 0, 0, 0);
        wrapped = new WrappedVerseNFT(nft);

        // Deploy timelock with 24 h delay; governor will be proposer
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // anyone can execute passed proposals
        timelock = new TimelockController(1 days, proposers, executors, address(this));

        governor = new DaoDeGenGovernor(wrapped, timelock);

        // Grant governor the PROPOSER + CANCELLER roles on the timelock
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));
        // Renounce admin role to make the timelock self-governing
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), address(this));
    }

    // -------------------------------------------------------------------------
    // Helper: mint VerseNFT, wrap it, and self-delegate for a holder
    // -------------------------------------------------------------------------
    function _mintWrapDelegate(address holder, uint256 tokenId) internal {
        nft.ownerMint(holder, tokenId);
        vm.startPrank(holder);
        nft.approve(address(wrapped), tokenId);
        uint256[] memory ids = new uint256[](1);
        ids[0] = tokenId;
        wrapped.depositFor(holder, ids);
        wrapped.delegate(holder);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    function test_Constants() public view {
        assertEq(governor.SIMPLE_MAJORITY_THRESHOLD(), 41);
        assertEq(governor.SUPERMAJORITY_THRESHOLD(), 55);
        assertEq(governor.quorum(0), 41);
        assertEq(governor.votingPeriod(), 302_400);
        assertEq(governor.votingDelay(), 1);
        assertEq(governor.proposalThreshold(), 1);
    }

    // -------------------------------------------------------------------------
    // Proposal type tagging
    // -------------------------------------------------------------------------

    function test_ProposeWithType_TagsProposal() public {
        _mintWrapDelegate(alice, 1);

        vm.roll(block.number + 1); // advance past delegation snapshot

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0xdead);

        vm.prank(alice);
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas,
            "Raise burn amount",
            DaoDeGenGovernor.ProposalType.MinBurnAmount
        );

        assertEq(uint8(governor.proposalTypes(pid)), uint8(DaoDeGenGovernor.ProposalType.MinBurnAmount));
    }

    // -------------------------------------------------------------------------
    // Simple majority: 41 for-votes required
    // -------------------------------------------------------------------------

    function test_SimpleMajority_SucceedsAt41Votes() public {
        // Mint and wrap 81 NFTs for unique holders
        for (uint256 i = 1; i <= 81; i++) {
            _mintWrapDelegate(address(uint160(0x1000 + i)), i);
        }

        vm.roll(block.number + 2);

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0xdead);

        vm.prank(address(uint160(0x1001)));
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas,
            "Raise minimum burn",
            DaoDeGenGovernor.ProposalType.MinBurnAmount
        );

        vm.roll(block.number + governor.votingDelay() + 1);

        // 41 holders vote FOR
        for (uint256 i = 1; i <= 41; i++) {
            vm.prank(address(uint160(0x1000 + i)));
            governor.castVote(pid, 1); // 1 = For
        }

        vm.roll(block.number + governor.votingPeriod() + 1);

        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Succeeded));
    }

    function test_SimpleMajority_FailsAt40Votes() public {
        for (uint256 i = 1; i <= 81; i++) {
            _mintWrapDelegate(address(uint160(0x1000 + i)), i);
        }

        vm.roll(block.number + 2);

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0xdead);

        vm.prank(address(uint160(0x1001)));
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas,
            "Raise minimum burn",
            DaoDeGenGovernor.ProposalType.MinBurnAmount
        );

        vm.roll(block.number + governor.votingDelay() + 1);

        // Only 40 holders vote FOR — one short
        for (uint256 i = 1; i <= 40; i++) {
            vm.prank(address(uint160(0x1000 + i)));
            governor.castVote(pid, 1);
        }

        vm.roll(block.number + governor.votingPeriod() + 1);

        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Defeated));
    }

    // -------------------------------------------------------------------------
    // Supermajority: 55 for-votes required
    // -------------------------------------------------------------------------

    function test_Supermajority_SucceedsAt55Votes() public {
        for (uint256 i = 1; i <= 81; i++) {
            _mintWrapDelegate(address(uint160(0x2000 + i)), i);
        }

        vm.roll(block.number + 2);

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0xdead);

        vm.prank(address(uint160(0x2001)));
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas,
            "Update pastor prompt",
            DaoDeGenGovernor.ProposalType.PastorPromptUpdate
        );

        vm.roll(block.number + governor.votingDelay() + 1);

        // 55 holders vote FOR
        for (uint256 i = 1; i <= 55; i++) {
            vm.prank(address(uint160(0x2000 + i)));
            governor.castVote(pid, 1);
        }

        vm.roll(block.number + governor.votingPeriod() + 1);

        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Succeeded));
    }

    // -------------------------------------------------------------------------
    // propose() disabled guard
    // -------------------------------------------------------------------------

    function test_Propose_RevertsDirectCall() public {
        _mintWrapDelegate(address(uint160(0x5001)), 1);
        vm.roll(block.number + 2);

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);

        vm.prank(address(uint160(0x5001)));
        vm.expectRevert("DaoDeGenGovernor: use proposeWithType");
        governor.propose(targets, values, calldatas, "bypass attempt");
    }

    // -------------------------------------------------------------------------
    // Full proposal lifecycle: propose → vote → queue (timelock) → execute
    // -------------------------------------------------------------------------

    function test_FullLifecycle_Queue_And_Execute() public {
        // 41 wrapped holders
        for (uint256 i = 1; i <= 41; i++) {
            _mintWrapDelegate(address(uint160(0x6000 + i)), i);
        }
        vm.roll(block.number + 2);

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0x1234); // EOA call with 0 value always succeeds
        string memory description  = "lifecycle test proposal";
        bytes32 descHash = keccak256(bytes(description));

        // Propose
        address proposer = address(uint160(0x6001));
        vm.prank(proposer);
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas, description,
            DaoDeGenGovernor.ProposalType.MinBurnAmount
        );

        // proposalNeedsQueuing should be true (timelock-backed Governor)
        assertTrue(governor.proposalNeedsQueuing(pid));

        vm.roll(block.number + governor.votingDelay() + 1);

        // Cast 41 FOR votes
        for (uint256 i = 1; i <= 41; i++) {
            vm.prank(address(uint160(0x6000 + i)));
            governor.castVote(pid, 1);
        }

        vm.roll(block.number + governor.votingPeriod() + 1);
        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Succeeded));

        // Queue into timelock
        governor.queue(targets, values, calldatas, descHash);
        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Queued));

        // Advance past timelock delay
        vm.warp(block.timestamp + 1 days + 1);

        // Execute
        governor.execute(targets, values, calldatas, descHash);
        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Executed));
    }

    // -------------------------------------------------------------------------
    // Cancel (proposer cancels a Pending proposal)
    // -------------------------------------------------------------------------

    function test_CancelProposal_ByProposer() public {
        _mintWrapDelegate(address(uint160(0x7001)), 1);
        vm.roll(block.number + 2);

        address proposer           = address(uint160(0x7001));
        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0xdead);
        string memory description  = "proposal to cancel";

        vm.prank(proposer);
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas, description,
            DaoDeGenGovernor.ProposalType.MinBurnAmount
        );
        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Pending));

        // Proposer cancels before voting begins
        vm.prank(proposer);
        governor.cancel(targets, values, calldatas, keccak256(bytes(description)));
        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Canceled));
    }

    function test_Supermajority_FailsAt41Votes() public {
        for (uint256 i = 1; i <= 81; i++) {
            _mintWrapDelegate(address(uint160(0x2000 + i)), i);
        }

        vm.roll(block.number + 2);

        address[] memory targets   = new address[](1);
        uint256[] memory values    = new uint256[](1);
        bytes[]   memory calldatas = new bytes[](1);
        targets[0] = address(0xdead);

        vm.prank(address(uint160(0x2001)));
        uint256 pid = governor.proposeWithType(
            targets, values, calldatas,
            "Switch to open-source model",
            DaoDeGenGovernor.ProposalType.ModelSelection
        );

        vm.roll(block.number + governor.votingDelay() + 1);

        // 41 votes — enough for simple majority but not supermajority
        for (uint256 i = 1; i <= 41; i++) {
            vm.prank(address(uint160(0x2000 + i)));
            governor.castVote(pid, 1);
        }

        vm.roll(block.number + governor.votingPeriod() + 1);

        assertEq(uint8(governor.state(pid)), uint8(IGovernor.ProposalState.Defeated));
    }
}
