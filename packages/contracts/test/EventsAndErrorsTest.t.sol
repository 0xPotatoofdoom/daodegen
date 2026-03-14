// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";

/// @title EventsAndErrorsTest
/// @notice RED TESTS for Issue #82: Missing events and custom errors
contract EventsAndErrorsTest is Test {
    DaoDeGenJar jar;
    DaoDeGenToken token;
    VerseNFT nft;

    event BurnAmountUpdated(uint256 newAmount);
    event BaseURIUpdated(string newBaseURI);
    event BaseMintPriceUpdated(uint256 newPrice);
    
    error TransferFailed();
    error InvalidTokenId();

    function setUp() public {
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("ipfs://test", 0.01 ether, 0, 0);
        jar = new DaoDeGenJar(address(token), address(nft), 100);
    }

    // --- DaoDeGenJar ---

    function test_Jar_EmitsEventOnSetBurnAmount() public {
        vm.expectEmit(true, false, false, true);
        emit BurnAmountUpdated(200);
        jar.setBurnAmount(200);
    }

    // --- VerseNFT ---

    function test_NFT_EmitsEventOnSetBaseURI() public {
        vm.expectEmit(true, false, false, true);
        emit BaseURIUpdated("ipfs://new");
        nft.setBaseURI("ipfs://new");
    }

    function test_NFT_EmitsEventOnSetBaseMintPrice() public {
        vm.expectEmit(true, false, false, true);
        emit BaseMintPriceUpdated(0.02 ether);
        nft.setBaseMintPrice(0.02 ether);
    }

    function test_NFT_RevertsWithCustomErrorOnInvalidOwnerMint() public {
        vm.expectRevert(InvalidTokenId.selector);
        nft.ownerMint(address(this), 99); // Max is 81
    }
}
