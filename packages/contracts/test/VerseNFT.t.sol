// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {VerseNFT} from "../src/VerseNFT.sol";

contract VerseNFTTest is Test {
    VerseNFT public verseNFT;
    address public owner;
    address public user1;
    address public user2;

    string constant BASE_URI = "https://api.daodegen.com/verse/";
    uint256 constant BASE_MINT_PRICE = 0.1 ether;
    uint256 constant PRICE_INCREMENT = 0.05 ether;
    uint256 constant MINT_COOLDOWN = 86400; // 1 day

    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);

        verseNFT = new VerseNFT(BASE_URI, BASE_MINT_PRICE, PRICE_INCREMENT, MINT_COOLDOWN);
    }

    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /// @dev Helper: compute the expected price for the Nth mint (0-indexed supply before mint)
    function _priceAtSupply(uint256 supply) internal pure returns (uint256) {
        return BASE_MINT_PRICE + (PRICE_INCREMENT * supply);
    }

    /// @dev Helper: compute total cost to mint `count` sequential tokens starting at `startSupply`
    function _totalCost(uint256 startSupply, uint256 count) internal pure returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < count; i++) {
            total += _priceAtSupply(startSupply + i);
        }
        return total;
    }

    function testInitialState() public {
        assertEq(verseNFT.name(), "Dao DeGen Verse");
        assertEq(verseNFT.symbol(), "VERSE");
        assertEq(verseNFT.baseMintPrice(), BASE_MINT_PRICE);
        assertEq(verseNFT.priceIncrement(), PRICE_INCREMENT);
        assertEq(verseNFT.mintCooldown(), MINT_COOLDOWN);
        assertEq(verseNFT.mintPrice(), BASE_MINT_PRICE); // supply is 0
        assertEq(verseNFT.MAX_SUPPLY(), 81);
        assertEq(verseNFT.totalSupply(), 0);
    }

    function testOwnerMint() public {
        verseNFT.ownerMint(user1, 5);
        assertEq(verseNFT.ownerOf(5), user1);
        assertEq(verseNFT.totalSupply(), 1);

        verseNFT.ownerMint(user2, 10);
        verseNFT.ownerMint(user2, 20);
        assertEq(verseNFT.ownerOf(10), user2);
        assertEq(verseNFT.ownerOf(20), user2);
        assertEq(verseNFT.totalSupply(), 3);
    }

    function testOwnerMintInvalidId() public {
        vm.expectRevert(VerseNFT.InvalidTokenId.selector);
        verseNFT.ownerMint(user1, 0);

        vm.expectRevert(VerseNFT.InvalidTokenId.selector);
        verseNFT.ownerMint(user1, 82);
    }

    function testOwnerMintOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        verseNFT.ownerMint(user1, 1);
    }

    function testMint() public {
        uint256 price = verseNFT.mintPrice();
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        verseNFT.mint{value: price}();

        assertEq(verseNFT.ownerOf(1), user1);
        assertEq(verseNFT.totalSupply(), 1);
    }

    function testMintInsufficientPayment() public {
        uint256 price = verseNFT.mintPrice();
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(VerseNFT.InsufficientPayment.selector);
        verseNFT.mint{value: price - 1}();
    }

    function testMintSequential() public {
        vm.deal(user1, 100 ether);

        // First mint from user1
        uint256 price1 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price1}();
        assertEq(verseNFT.ownerOf(1), user1);

        // Warp past cooldown, mint from user1 again
        vm.warp(block.timestamp + MINT_COOLDOWN + 1);
        uint256 price2 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price2}();
        assertEq(verseNFT.ownerOf(2), user1);

        // Warp past cooldown, mint from user1 again
        vm.warp(block.timestamp + MINT_COOLDOWN + 1);
        uint256 price3 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price3}();
        assertEq(verseNFT.ownerOf(3), user1);
    }

    function testMintSkipsOwnerMintedTokens() public {
        vm.deal(user2, 100 ether);

        // Owner mints token ID 2
        verseNFT.ownerMint(user1, 2);

        // User mints - should get token 1, then skip 2 and get 3
        uint256 price1 = verseNFT.mintPrice(); // supply is 1 (ownerMint counts)
        vm.prank(user2);
        verseNFT.mint{value: price1}();

        vm.warp(block.timestamp + MINT_COOLDOWN + 1);
        uint256 price2 = verseNFT.mintPrice();
        vm.prank(user2);
        verseNFT.mint{value: price2}();

        assertEq(verseNFT.ownerOf(1), user2);
        assertEq(verseNFT.ownerOf(2), user1);
        assertEq(verseNFT.ownerOf(3), user2);
    }

    function testMintMaxSupply() public {
        // Disable cooldown for this test
        verseNFT.setMintCooldown(0);

        // Mint 81 tokens (max supply) from different addresses to avoid cooldown
        for (uint256 i = 1; i <= 81; i++) {
            address minter = address(uint160(0x1000 + i));
            uint256 price = verseNFT.mintPrice();
            vm.deal(minter, price);
            vm.prank(minter);
            verseNFT.mint{value: price}();
        }

        assertEq(verseNFT.totalSupply(), 81);

        // 82nd mint should fail
        vm.deal(user2, 100 ether);
        vm.prank(user2);
        vm.expectRevert(VerseNFT.MaxSupplyReached.selector);
        verseNFT.mint{value: 100 ether}();
    }

    function testWithdraw() public {
        vm.deal(user1, 1 ether);
        uint256 price = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price}();

        uint256 initialBalance = address(this).balance;
        verseNFT.withdraw();
        uint256 finalBalance = address(this).balance;

        assertEq(finalBalance - initialBalance, price);
    }

    function testTokenURI() public {
        verseNFT.ownerMint(user1, 5);
        string memory expectedURI = string(abi.encodePacked(BASE_URI, "5"));
        assertEq(verseNFT.tokenURI(5), expectedURI);
    }

    function testSetBaseURI() public {
        string memory newBaseURI = "https://new-api.daodegen.com/verse/";
        verseNFT.setBaseURI(newBaseURI);

        verseNFT.ownerMint(user1, 1);
        string memory expectedURI = string(abi.encodePacked(newBaseURI, "1"));
        assertEq(verseNFT.tokenURI(1), expectedURI);
    }

    function testPauseMint() public {
        vm.deal(user1, 10 ether);
        uint256 price = verseNFT.mintPrice();

        // Pause
        verseNFT.pause();

        // Mint should revert when paused
        vm.prank(user1);
        vm.expectRevert();
        verseNFT.mint{value: price}();

        // Unpause
        verseNFT.unpause();

        // Mint should succeed now
        vm.prank(user1);
        verseNFT.mint{value: price}();
        assertEq(verseNFT.ownerOf(1), user1);
    }

    function testOwnerMintWhilePaused() public {
        verseNFT.pause();

        verseNFT.ownerMint(user1, 42);
        assertEq(verseNFT.ownerOf(42), user1);

        verseNFT.unpause();
    }

    // ---- Bonding Curve Tests ----

    function testBondingCurvePrice() public {
        // At supply 0, price = BASE_MINT_PRICE
        assertEq(verseNFT.mintPrice(), BASE_MINT_PRICE);

        // Mint one -- price should increase
        vm.deal(user1, 100 ether);
        vm.prank(user1);
        verseNFT.mint{value: BASE_MINT_PRICE}();

        // At supply 1, price = BASE_MINT_PRICE + PRICE_INCREMENT
        assertEq(verseNFT.mintPrice(), BASE_MINT_PRICE + PRICE_INCREMENT);

        // ownerMint also increases supply
        verseNFT.ownerMint(user2, 5);
        // At supply 2
        assertEq(verseNFT.mintPrice(), BASE_MINT_PRICE + 2 * PRICE_INCREMENT);
    }

    function testBondingCurvePriceMath() public {
        // Verify the formula: price at supply N = baseMintPrice + N * priceIncrement
        for (uint256 i = 0; i < 5; i++) {
            assertEq(verseNFT.mintPrice(), _priceAtSupply(i));
            verseNFT.ownerMint(address(uint160(0x100 + i)), i + 1);
        }
    }

    // ---- Cooldown Tests ----

    function testMintCooldownEnforced() public {
        vm.deal(user1, 100 ether);

        // First mint succeeds
        uint256 price1 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price1}();

        // Second mint within 24h reverts
        uint256 price2 = verseNFT.mintPrice();
        vm.prank(user1);
        vm.expectRevert(VerseNFT.MintCooldownActive.selector);
        verseNFT.mint{value: price2}();
    }

    function testMintCooldownExpired() public {
        vm.deal(user1, 100 ether);

        uint256 price1 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price1}();

        // Warp past cooldown
        vm.warp(block.timestamp + MINT_COOLDOWN + 1);

        uint256 price2 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price2}();

        assertEq(verseNFT.ownerOf(2), user1);
    }

    function testOwnerMintBypassesCooldown() public {
        // ownerMint has no cooldown
        verseNFT.ownerMint(user1, 1);
        verseNFT.ownerMint(user1, 2);
        verseNFT.ownerMint(user1, 3);

        assertEq(verseNFT.totalSupply(), 3);
    }

    function testCooldownDisabledWhenZero() public {
        verseNFT.setMintCooldown(0);
        vm.deal(user1, 100 ether);

        // Two mints in the same block should succeed
        uint256 price1 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price1}();

        uint256 price2 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price2}();

        assertEq(verseNFT.ownerOf(1), user1);
        assertEq(verseNFT.ownerOf(2), user1);
    }

    function testDifferentAddressesCanMintWithinCooldown() public {
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

        uint256 price1 = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price1}();

        // user2 has no cooldown -- can mint immediately
        uint256 price2 = verseNFT.mintPrice();
        vm.prank(user2);
        verseNFT.mint{value: price2}();

        assertEq(verseNFT.ownerOf(1), user1);
        assertEq(verseNFT.ownerOf(2), user2);
    }

    // ---- Setter Tests ----

    function testSetBaseMintPrice() public {
        uint256 newPrice = 0.2 ether;
        verseNFT.setBaseMintPrice(newPrice);
        assertEq(verseNFT.baseMintPrice(), newPrice);
        assertEq(verseNFT.mintPrice(), newPrice); // supply is 0, so mintPrice == baseMintPrice
    }

    function testSetPriceIncrement() public {
        uint256 newIncrement = 0.1 ether;
        verseNFT.setPriceIncrement(newIncrement);
        assertEq(verseNFT.priceIncrement(), newIncrement);

        // ownerMint to bump supply
        verseNFT.ownerMint(user1, 1);
        assertEq(verseNFT.mintPrice(), BASE_MINT_PRICE + newIncrement);
    }

    function testSetMintCooldown() public {
        uint256 newCooldown = 3600; // 1 hour
        verseNFT.setMintCooldown(newCooldown);
        assertEq(verseNFT.mintCooldown(), newCooldown);
    }

    function testSettersOnlyOwner() public {
        vm.startPrank(user1);

        vm.expectRevert();
        verseNFT.setBaseMintPrice(1);

        vm.expectRevert();
        verseNFT.setPriceIncrement(1);

        vm.expectRevert();
        verseNFT.setMintCooldown(1);

        vm.stopPrank();
    }

    // ---- nextMintableTimestamp Tests ----

    function testNextMintableTimestamp() public {
        vm.deal(user1, 100 ether);

        // Before minting, nextMintableTimestamp should be block.timestamp
        assertEq(verseNFT.nextMintableTimestamp(user1), block.timestamp);

        // Mint
        uint256 price = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price}();

        // nextMintableTimestamp should be lastMintTimestamp + cooldown
        assertEq(verseNFT.nextMintableTimestamp(user1), block.timestamp + MINT_COOLDOWN);

        // After cooldown expires, should return block.timestamp
        vm.warp(block.timestamp + MINT_COOLDOWN + 1);
        assertEq(verseNFT.nextMintableTimestamp(user1), block.timestamp);
    }

    function testNextMintableTimestampWithZeroCooldown() public {
        verseNFT.setMintCooldown(0);
        assertEq(verseNFT.nextMintableTimestamp(user1), block.timestamp);

        // Even after minting, still returns block.timestamp
        vm.deal(user1, 100 ether);
        uint256 price = verseNFT.mintPrice();
        vm.prank(user1);
        verseNFT.mint{value: price}();
        assertEq(verseNFT.nextMintableTimestamp(user1), block.timestamp);
    }
}
