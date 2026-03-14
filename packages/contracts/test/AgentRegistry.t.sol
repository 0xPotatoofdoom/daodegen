// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    address public agent1;
    address public agent2;

    function setUp() public {
        registry = new AgentRegistry();
        agent1 = address(0x1);
        agent2 = address(0x2);
    }

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

    function testSoulbound() public {
        vm.startPrank(agent1);
        registry.register("ipfs://meta");
        
        vm.expectRevert(AgentRegistry.Soulbound.selector);
        registry.transferFrom(agent1, agent2, 1);
        vm.stopPrank();
    }
}
