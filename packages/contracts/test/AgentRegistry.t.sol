// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    address public agent1;
    address public agent2;

    function setUp() public {
        registry = new AgentRegistry();
        agent1 = address(0x1);
        agent2 = address(0x2);
    }

    // ─── Registration ────────────────────────────────────────────────

    function testRegistration() public {
        vm.startPrank(agent1);

        string memory metadata = "ipfs://QmAgentMetadata";
        uint256 tokenId = registry.register(metadata);

        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(1), agent1);
        assertEq(registry.tokenURI(1), metadata);
        assertTrue(registry.isAgent(agent1));
        assertEq(registry.getAgentId(agent1), 1);

        vm.stopPrank();
    }

    function testCannotRegisterTwice() public {
        vm.startPrank(agent1);
        registry.register("ipfs://meta1");

        vm.expectRevert(AgentRegistry.AgentAlreadyRegistered.selector);
        registry.register("ipfs://meta2");
        vm.stopPrank();
    }

    function testCannotRegisterEmptyMetadata() public {
        vm.prank(agent1);
        vm.expectRevert(AgentRegistry.InvalidMetadata.selector);
        registry.register("");
    }

    function testRegistrationEmitsEvent() public {
        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistry.AgentRegistered(agent1, 1, "ipfs://meta");
        registry.register("ipfs://meta");
    }

    function testMultipleAgentsGetIncrementingIds() public {
        vm.prank(agent1);
        uint256 id1 = registry.register("ipfs://meta1");

        vm.prank(agent2);
        uint256 id2 = registry.register("ipfs://meta2");

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    // ─── Update ──────────────────────────────────────────────────────

    function testUpdateMetadata() public {
        vm.startPrank(agent1);
        registry.register("ipfs://meta1");

        string memory newMeta = "ipfs://meta2";
        registry.update(newMeta);

        assertEq(registry.tokenURI(1), newMeta);
        vm.stopPrank();
    }

    function testCannotUpdateIfNotRegistered() public {
        vm.startPrank(agent1);
        vm.expectRevert(AgentRegistry.AgentNotRegistered.selector);
        registry.update("ipfs://meta");
        vm.stopPrank();
    }

    function testCannotUpdateWithEmptyMetadata() public {
        vm.startPrank(agent1);
        registry.register("ipfs://meta1");

        vm.expectRevert(AgentRegistry.InvalidMetadata.selector);
        registry.update("");
        vm.stopPrank();
    }

    function testUpdateEmitsEvent() public {
        vm.startPrank(agent1);
        registry.register("ipfs://meta1");

        vm.expectEmit(true, true, false, true);
        emit AgentRegistry.AgentUpdated(agent1, 1, "ipfs://meta2");
        registry.update("ipfs://meta2");
        vm.stopPrank();
    }

    // ─── Revoke ──────────────────────────────────────────────────────

    function testRevoke() public {
        vm.prank(agent1);
        registry.register("ipfs://meta");

        // Owner (this contract) revokes agent1
        registry.revoke(agent1);

        assertFalse(registry.isAgent(agent1));
        assertEq(registry.getAgentId(agent1), 0);

        // Token should no longer exist
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 1));
        registry.ownerOf(1);
    }

    function testRevokeEmitsEvent() public {
        vm.prank(agent1);
        registry.register("ipfs://meta");

        vm.expectEmit(true, true, false, false);
        emit AgentRegistry.AgentRevoked(agent1, 1);
        registry.revoke(agent1);
    }

    function testRevokeOnlyOwner() public {
        vm.prank(agent1);
        registry.register("ipfs://meta");

        // Non-owner tries to revoke
        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, agent2));
        registry.revoke(agent1);
    }

    function testCannotRevokeNonExistentAgent() public {
        vm.expectRevert(AgentRegistry.AgentNotRegistered.selector);
        registry.revoke(agent1);
    }

    function testRegisterAfterRevoke() public {
        vm.prank(agent1);
        registry.register("ipfs://meta1");

        registry.revoke(agent1);

        // Agent should be able to re-register after revocation
        vm.prank(agent1);
        uint256 newId = registry.register("ipfs://meta2");

        assertEq(newId, 2); // New token ID, not reusing old one
        assertTrue(registry.isAgent(agent1));
        assertEq(registry.getAgentId(agent1), 2);
    }

    // ─── Soulbound ───────────────────────────────────────────────────

    function testSoulbound() public {
        vm.startPrank(agent1);
        registry.register("ipfs://meta");

        vm.expectRevert(AgentRegistry.Soulbound.selector);
        registry.transferFrom(agent1, agent2, 1);
        vm.stopPrank();
    }

    // ─── Pause ───────────────────────────────────────────────────────

    function testCannotRegisterWhenPaused() public {
        registry.pause();

        vm.prank(agent1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.register("ipfs://meta");
    }

    function testCannotUpdateWhenPaused() public {
        vm.prank(agent1);
        registry.register("ipfs://meta1");

        registry.pause();

        vm.prank(agent1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.update("ipfs://meta2");
    }

    function testRevokeWorksWhenPaused() public {
        vm.prank(agent1);
        registry.register("ipfs://meta");

        registry.pause();

        // Revoke is not gated by whenNotPaused — owner can always revoke
        registry.revoke(agent1);
        assertFalse(registry.isAgent(agent1));
    }

    function testPauseUnpauseOnlyOwner() public {
        vm.startPrank(agent1);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, agent1));
        registry.pause();

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, agent1));
        registry.unpause();

        vm.stopPrank();
    }

    function testCanRegisterAfterUnpause() public {
        registry.pause();
        registry.unpause();

        vm.prank(agent1);
        uint256 id = registry.register("ipfs://meta");
        assertEq(id, 1);
    }
}
