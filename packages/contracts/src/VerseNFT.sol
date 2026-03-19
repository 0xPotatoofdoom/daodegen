// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @title VerseNFT
/// @notice 81 NFTs — one per verse of the Dao DeGen
contract VerseNFT is ERC721Enumerable, Ownable, Pausable {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 81;
    uint256 public baseMintPrice;
    uint256 public priceIncrement;
    uint256 public mintCooldown;
    string public baseTokenURI;
    uint256 private _nextTokenId = 1;

    uint256 public mintRevenue;

    mapping(address => uint256) public lastMintTimestamp;

    error MaxSupplyReached();
    error InsufficientPayment();
    error InvalidTokenId();
    error MintCooldownActive();
    error NothingToWithdraw();

    event BaseURIUpdated(string newBaseURI);
    event BaseMintPriceUpdated(uint256 newPrice);
    event PriceIncrementUpdated(uint256 newIncrement);
    event MintCooldownUpdated(uint256 newCooldown);
    event MintRefunded(address indexed minter, uint256 excess);

    constructor(
        string memory _initialBaseURI,
        uint256 _baseMintPrice,
        uint256 _priceIncrement,
        uint256 _mintCooldown
    ) ERC721("Dao DeGen Verse", "VERSE") Ownable(msg.sender) {
        baseTokenURI = _initialBaseURI;
        baseMintPrice = _baseMintPrice;
        priceIncrement = _priceIncrement;
        mintCooldown = _mintCooldown;
    }

    /// @notice Current mint price based on bonding curve: baseMintPrice + (priceIncrement * totalSupply)
    function mintPrice() public view returns (uint256) {
        return baseMintPrice + (priceIncrement * totalSupply());
    }

    /// @notice Mint the next available verse NFT
    function mint() external payable whenNotPaused {
        if (mintCooldown > 0 && lastMintTimestamp[msg.sender] > 0 && block.timestamp < lastMintTimestamp[msg.sender] + mintCooldown) {
            revert MintCooldownActive();
        }
        uint256 price = mintPrice();
        if (msg.value < price) revert InsufficientPayment();

        while (_nextTokenId <= MAX_SUPPLY && _ownerOf(_nextTokenId) != address(0)) {
            _nextTokenId++;
        }

        if (_nextTokenId > MAX_SUPPLY) revert MaxSupplyReached();

        lastMintTimestamp[msg.sender] = block.timestamp;
        mintRevenue += price;
        _safeMint(msg.sender, _nextTokenId);
        _nextTokenId++;

        uint256 excess = msg.value - price;
        if (excess > 0) {
            emit MintRefunded(msg.sender, excess);
            Address.sendValue(payable(msg.sender), excess);
        }
    }

    /// @notice Owner can mint specific verse IDs
    /// @dev Intentionally not gated by whenNotPaused — allows owner to seed
    ///      NFTs or correct state even while public mint is paused.
    ///      Exempt from cooldown and price.
    function ownerMint(address to, uint256 tokenId) external onlyOwner {
        if (tokenId < 1 || tokenId > MAX_SUPPLY) revert InvalidTokenId();
        _safeMint(to, tokenId);
    }

    /// @notice Returns the earliest timestamp at which `addr` can mint again
    function nextMintableTimestamp(address addr) external view returns (uint256) {
        if (mintCooldown == 0 || lastMintTimestamp[addr] == 0) return block.timestamp;
        uint256 nextTime = lastMintTimestamp[addr] + mintCooldown;
        return nextTime > block.timestamp ? nextTime : block.timestamp;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        baseTokenURI = _newBaseURI;
        emit BaseURIUpdated(_newBaseURI);
    }

    function setBaseMintPrice(uint256 _price) external onlyOwner {
        baseMintPrice = _price;
        emit BaseMintPriceUpdated(_price);
    }

    function setPriceIncrement(uint256 _increment) external onlyOwner {
        priceIncrement = _increment;
        emit PriceIncrementUpdated(_increment);
    }

    function setMintCooldown(uint256 _cooldown) external onlyOwner {
        mintCooldown = _cooldown;
        emit MintCooldownUpdated(_cooldown);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdraw() external onlyOwner {
        uint256 amount = mintRevenue;
        if (amount == 0) revert NothingToWithdraw();
        mintRevenue = 0;
        Address.sendValue(payable(msg.sender), amount);
    }
}
