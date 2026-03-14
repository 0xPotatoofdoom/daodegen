// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

/// @title AgentRegistryFeaturesTest
/// @notice RED TEST for Issue #93: AgentRegistry missing revocation, pause, and metadata validation
contract AgentRegistryFeaturesTest is Test {
    AgentRegistry registry;

    error InvalidMetadata();

    function setUp() public {
        registry = new AgentRegistry();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function test_Registry_CanRevokeAgent() public {
        registry.register("ipfs://test");
        address agent = address(this);
        
        registry.revoke(agent); 
        assertFalse(registry.isAgent(agent), "Agent should be revoked");
    }

    function test_Registry_CanPauseRegistration() public {
        registry.pause();
        vm.expectRevert(); // Base Pausable reverts with empty bytes or custom error depending on version
        registry.register("ipfs://test");
    }

    function test_Registry_CanUnpause() public {
        registry.pause();
        registry.unpause();
        // Registration should succeed after unpause
        registry.register("ipfs://test");
        assertTrue(registry.isAgent(address(this)));
    }

    function test_Registry_ValidatesMetadata() public {
        vm.expectRevert(InvalidMetadata.selector);
        registry.register("");
    }
}
