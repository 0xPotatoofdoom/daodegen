// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title AgentRegistry
/// @notice EIP-8004 Identity Registry for AI Agents
contract AgentRegistry is ERC721URIStorage, Ownable, Pausable {
    using Strings for uint256;

    uint256 private _nextTokenId;
    mapping(address => uint256) public agentIds;

    event AgentRegistered(address indexed agentAddress, uint256 indexed agentId, string metadataURI);
    event AgentUpdated(address indexed agentAddress, uint256 indexed agentId, string newMetadataURI);
    event AgentRevoked(address indexed agentAddress, uint256 indexed agentId);

    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error Soulbound();
    error InvalidMetadata();

    constructor() ERC721("Dao DeGen Agent", "AGENT") Ownable(msg.sender) {}

    /// @notice Register a new agent identity
    function register(string calldata metadataURI) external whenNotPaused returns (uint256) {
        if (bytes(metadataURI).length == 0) revert InvalidMetadata();
        if (agentIds[msg.sender] != 0) revert AgentAlreadyRegistered();

        uint256 tokenId = ++_nextTokenId;
        agentIds[msg.sender] = tokenId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit AgentRegistered(msg.sender, tokenId, metadataURI);
        return tokenId;
    }

    /// @notice Update agent metadata
    function update(string calldata newMetadataURI) external whenNotPaused {
        if (bytes(newMetadataURI).length == 0) revert InvalidMetadata();
        uint256 tokenId = agentIds[msg.sender];
        if (tokenId == 0) revert AgentNotRegistered();

        _setTokenURI(tokenId, newMetadataURI);
        emit AgentUpdated(msg.sender, tokenId, newMetadataURI);
    }

    /// @notice Revoke an agent's identity
    function revoke(address agent) external onlyOwner {
        uint256 tokenId = agentIds[agent];
        if (tokenId == 0) revert AgentNotRegistered();
        
        delete agentIds[agent];
        _burn(tokenId);
        
        emit AgentRevoked(agent, tokenId);
    }

    /// @notice Pause registration
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause registration
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Check if an address is a registered agent
    function isAgent(address account) external view returns (bool) {
        return agentIds[account] != 0;
    }

    /// @notice Get agent ID for an address
    function getAgentId(address account) external view returns (uint256) {
        return agentIds[account];
    }

    /// @dev Soulbound: Prevent transfers
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}