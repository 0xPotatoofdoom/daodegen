// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";

/// @title FuzzTest
/// @notice Property-based tests for DaoDeGen ecosystem
contract FuzzTest is Test {
    DaoDeGenToken token;
    DaoDeGenJar jar;
    VerseNFT nft;

    function setUp() public {
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("ipfs://test/", 0, 0, 0);
        jar = new DaoDeGenJar(address(token), address(nft), 0); // 0 burn for fuzz simplicity
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {}

    /// @notice Verify that max supply is never exceeded through transfers
    function testFuzz_MaxSupply(address to, uint256 amount) public {
        vm.assume(to != address(0) && to != address(this));

        uint256 balanceBefore = token.balanceOf(address(this));
        uint256 supplyBefore = token.totalSupply();

        // Cap amount to available balance
        amount = bound(amount, 0, balanceBefore);

        token.transfer(to, amount);

        assertEq(token.totalSupply(), supplyBefore, "Total supply changed during transfer");
        assertLe(token.totalSupply(), token.MAX_SUPPLY(), "Total supply exceeds MAX_SUPPLY");
    }

    /// @notice Verify that burning correctly reduces supply
    function testFuzz_Burn(uint256 amount) public {
        uint256 balanceBefore = token.balanceOf(address(this));
        uint256 supplyBefore = token.totalSupply();

        amount = bound(amount, 0, balanceBefore);

        token.burn(amount);

        assertEq(token.totalSupply(), supplyBefore - amount, "Total supply did not decrease correctly");
        assertEq(token.balanceOf(address(this)), balanceBefore - amount, "Balance did not decrease correctly");
    }

    /// @notice Verify jar distribution invariants: totalClaimable <= fundAmount
    function testFuzz_JarDistribution(uint8 nftCount, uint96 fundAmount) public {
        vm.assume(nftCount > 0 && nftCount <= 81);
        vm.assume(fundAmount > 0);

        // Mint NFTs
        for (uint256 i = 1; i <= nftCount; i++) {
            nft.ownerMint(address(this), i);
        }

        // Fund jar with ETH
        vm.deal(address(this), uint256(fundAmount));
        (bool success,) = address(jar).call{value: fundAmount}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Release
        jar.release(assets);

        // Verify: total claimable across all NFTs <= fundAmount
        uint256 totalClaimable = 0;
        for (uint256 i = 1; i <= nftCount; i++) {
            totalClaimable += jar.claimable(i, assets[0]);
        }

        assertLe(totalClaimable, uint256(fundAmount), "Total claimable exceeds fund amount");
        assertEq(totalClaimable, jar.outstanding(assets[0]), "Claimable mismatch with outstanding");

        // Verify: dust loss is at most (nftCount - 1) wei
        uint256 dust = uint256(fundAmount) - totalClaimable;
        assertLe(dust, uint256(nftCount) - 1, "Dust exceeds maximum expected");
    }
}