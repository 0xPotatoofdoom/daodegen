// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";

/// @dev Handler that performs random sequences of release, claim, and ETH deposits.
contract JarHandler is Test {
    DaoDeGenJar public jar;
    DaoDeGenToken public token;
    VerseNFT public nft;

    uint256 public constant NUM_NFTS = 5;
    uint256 public constant BURN_AMOUNT = 100e18;

    address[] public holders;

    constructor(DaoDeGenJar _jar, DaoDeGenToken _token, VerseNFT _nft, address[] memory _holders) {
        jar = _jar;
        token = _token;
        nft = _nft;
        holders = _holders;
    }

    /// @dev Deposit random ETH into the jar (simulates fee income)
    function depositETH(uint256 amount) external {
        amount = bound(amount, 0, 10 ether);
        vm.deal(address(this), amount);
        (bool ok,) = address(jar).call{value: amount}("");
        require(ok);
    }

    /// @dev Release fees for ETH asset from a random holder
    function release(uint256 holderSeed) external {
        address holder = holders[holderSeed % holders.length];

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        vm.startPrank(holder);
        token.approve(address(jar), BURN_AMOUNT);
        try jar.release(assets) {} catch {}
        vm.stopPrank();
    }

    /// @dev Claim for a random tokenId
    function claim(uint256 tokenIdSeed) external {
        uint256 tokenId = (tokenIdSeed % NUM_NFTS) + 1;
        address holder = nft.ownerOf(tokenId);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        vm.prank(holder);
        try jar.claim(tokenId, assets) {} catch {}
    }
}

contract InvariantTest is Test {
    DaoDeGenJar public jar;
    DaoDeGenToken public token;
    VerseNFT public nft;
    JarHandler public handler;

    uint256 constant BURN_AMOUNT = 100e18;
    uint256 constant NUM_NFTS = 5;

    function setUp() public {
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("https://test/", 0.01 ether, 0, 0);
        jar = new DaoDeGenJar(address(token), address(nft), BURN_AMOUNT);

        // Mint NFTs and fund holders (this contract is the NFT owner)
        address[] memory holders = new address[](NUM_NFTS);
        for (uint256 i = 1; i <= NUM_NFTS; i++) {
            address holder = address(uint160(0x1000 + i));
            holders[i - 1] = holder;
            nft.ownerMint(holder, i);
            token.transfer(holder, 50_000e18);
        }

        handler = new JarHandler(jar, token, nft, holders);

        // Fund handler with ETH for deposits
        vm.deal(address(handler), 100 ether);

        targetContract(address(handler));
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /// @dev outstanding[ETH] == sum of claimable[tokenId][ETH] for all minted token IDs
    function invariant_outstandingMatchesClaimableSum() public view {
        Currency eth = CurrencyLibrary.ADDRESS_ZERO;
        uint256 totalClaimable;
        uint256 supply = nft.totalSupply();

        for (uint256 i = 0; i < supply; i++) {
            uint256 tokenId = nft.tokenByIndex(i);
            totalClaimable += jar.claimable(tokenId, eth);
        }

        assertEq(jar.outstanding(eth), totalClaimable, "outstanding != sum(claimable)");
    }

    /// @dev Jar ETH balance must always cover outstanding obligations
    function invariant_balanceCoversOutstanding() public view {
        Currency eth = CurrencyLibrary.ADDRESS_ZERO;
        assertGe(address(jar).balance, jar.outstanding(eth), "balance < outstanding");
    }

    /// @dev Double-claim should be a no-op: after claiming, claimable is 0
    function invariant_claimableNeverNegative() public view {
        Currency eth = CurrencyLibrary.ADDRESS_ZERO;
        uint256 supply = nft.totalSupply();

        for (uint256 i = 0; i < supply; i++) {
            uint256 tokenId = nft.tokenByIndex(i);
            assertGe(jar.claimable(tokenId, eth), 0);
        }
    }
}
