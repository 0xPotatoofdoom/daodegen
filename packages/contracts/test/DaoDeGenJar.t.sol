// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DaoDeGenJarTest is Test {
    DaoDeGenJar public jar;
    DaoDeGenToken public token;
    VerseNFT public nft;
    
    address public owner;
    address public user1;
    address public user2;
    
    uint256 constant BURN_AMOUNT = 100e18;
    
    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        // Deploy Token
        token = new DaoDeGenToken(owner);
        
        // Deploy NFT
        nft = new VerseNFT("https://test/", 0.01 ether, 0, 0);
        
        // Deploy Jar
        jar = new DaoDeGenJar(address(token), address(nft), BURN_AMOUNT);
        
        // Setup initial state
        // Give users some tokens for burning
        token.transfer(user1, 1000e18);
        token.transfer(user2, 1000e18);
    }
    
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // Add receive to accept ETH from Jar
    receive() external payable {}
    
    function testInitialState() public {
        assertEq(address(jar.daodegen()), address(token));
        assertEq(address(jar.nft()), address(nft));
        assertEq(jar.burnAmount(), BURN_AMOUNT);
    }
    
    function testReleaseRevertsWithNoNFTs() public {
        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;
        
        vm.prank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        
        vm.prank(user1);
        vm.expectRevert(DaoDeGenJar.NothingToRelease.selector);
        jar.release(assets);
    }
    
    function testReleaseRevertsWithInsufficientBurn() public {
        // Mint an NFT so we pass the first check
        nft.ownerMint(user1, 1);
        
        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;
        
        vm.prank(user1);
        // No approval
        vm.expectRevert(); // Should revert due to ERC20 transferFrom failure
        jar.release(assets);
    }
    
    function testReleaseETH() public {
        // 1. Setup NFT holders
        // user1 holds 1 NFT (ID 1)
        nft.ownerMint(user1, 1);
        // user2 holds 2 NFTs (IDs 2, 3)
        nft.ownerMint(user2, 2);
        nft.ownerMint(user2, 3);
        
        // Total 3 NFTs
        
        // 2. Fund Jar with ETH
        uint256 totalReward = 3 ether;
        (bool success,) = address(jar).call{value: totalReward}("");
        require(success);
        
        // 3. User1 prepares to release
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        
        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;
        
        // 4. Release
        jar.release(assets);
        vm.stopPrank();
        
        // 5. Verify rewards are in claimable mapping
        // Per NFT reward = 3 ether / 3 = 1 ether
        assertEq(jar.claimable(1, assets[0]), 1 ether);
        assertEq(jar.claimable(2, assets[0]), 1 ether);
        assertEq(jar.claimable(3, assets[0]), 1 ether);
        
        // 6. Claim
        uint256 user1PreBalance = user1.balance;
        vm.prank(user1);
        jar.claim(1, assets);
        assertEq(user1.balance - user1PreBalance, 1 ether);
        assertEq(jar.claimable(1, assets[0]), 0);

        uint256 user2PreBalance = user2.balance;
        vm.prank(user2);
        jar.claim(2, assets);
        vm.prank(user2);
        jar.claim(3, assets);
        assertEq(user2.balance - user2PreBalance, 2 ether);
        
        assertEq(address(jar).balance, 0);
        
        // Verify burn
        assertEq(token.balanceOf(user1), 1000e18 - BURN_AMOUNT);
    }
    
    function testReleaseERC20() public {
        DaoDeGenToken rewardToken = new DaoDeGenToken(address(this));
        
        // 1. Setup NFT holders
        nft.ownerMint(user1, 1);
        nft.ownerMint(user2, 2);
        
        // 2. Fund Jar with Reward Token
        uint256 totalReward = 300e18;
        rewardToken.transfer(address(jar), totalReward);
        
        // 3. Prepare release
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        
        Currency[] memory assets = new Currency[](1);
        assets[0] = Currency.wrap(address(rewardToken));
        
        // 4. Release
        jar.release(assets);
        vm.stopPrank();
        
        // 5. Verify claimable
        assertEq(jar.claimable(1, assets[0]), 150e18);
        assertEq(jar.claimable(2, assets[0]), 150e18);

        // 6. Claim
        vm.prank(user1);
        jar.claim(1, assets);
        assertEq(rewardToken.balanceOf(user1), 150e18);

        vm.prank(user2);
        jar.claim(2, assets);
        assertEq(rewardToken.balanceOf(user2), 150e18);
        
        assertEq(rewardToken.balanceOf(address(jar)), 0);
    }
    
    function testDuplicateAssetReverts() public {
        nft.ownerMint(user1, 1);

        (bool success,) = address(jar).call{value: 2 ether}("");
        require(success);

        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);

        Currency[] memory assets = new Currency[](2);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;
        assets[1] = CurrencyLibrary.ADDRESS_ZERO; // duplicate

        vm.expectRevert(DaoDeGenJar.DuplicateAsset.selector);
        jar.release(assets);
        vm.stopPrank();
    }

    function testRepeatedReleaseOnlyDistributesNewFunds() public {
        nft.ownerMint(user1, 1);
        nft.ownerMint(user2, 2);

        // Fund jar with 2 ETH
        (bool success,) = address(jar).call{value: 2 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // First release: distributes 2 ETH (1 each)
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT * 3);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.claimable(1, assets[0]), 1 ether);
        assertEq(jar.claimable(2, assets[0]), 1 ether);

        // Second release with no new funds: nothing additional distributed
        vm.startPrank(user1);
        jar.release(assets);
        vm.stopPrank();

        // Claimable should NOT have doubled
        assertEq(jar.claimable(1, assets[0]), 1 ether);
        assertEq(jar.claimable(2, assets[0]), 1 ether);

        // Add 4 more ETH, release again
        (success,) = address(jar).call{value: 4 ether}("");
        require(success);

        vm.startPrank(user1);
        jar.release(assets);
        vm.stopPrank();

        // Only the new 4 ETH distributed (2 each), totaling 3 each
        assertEq(jar.claimable(1, assets[0]), 3 ether);
        assertEq(jar.claimable(2, assets[0]), 3 ether);

        // Both can claim their full share
        uint256 user1Pre = user1.balance;
        vm.prank(user1);
        jar.claim(1, assets);
        assertEq(user1.balance - user1Pre, 3 ether);

        uint256 user2Pre = user2.balance;
        vm.prank(user2);
        jar.claim(2, assets);
        assertEq(user2.balance - user2Pre, 3 ether);

        // Jar drained exactly
        assertEq(address(jar).balance, 0);
    }

    function testOutstandingDecreasesOnClaim() public {
        nft.ownerMint(user1, 1);

        (bool success,) = address(jar).call{value: 5 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT * 2);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.outstanding(assets[0]), 5 ether);

        // Claim reduces outstanding
        vm.prank(user1);
        jar.claim(1, assets);
        assertEq(jar.outstanding(assets[0]), 0);

        // New funds can now be distributed
        (success,) = address(jar).call{value: 3 ether}("");
        require(success);

        vm.startPrank(user1);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.claimable(1, assets[0]), 3 ether);
        assertEq(jar.outstanding(assets[0]), 3 ether);
    }

    function testDrainAttackPrevented() public {
        // Proof of concept from the vulnerability report:
        // 81 NFTs, 81 ETH, attacker owns 1 NFT, tries to drain via repeated release
        uint256 totalNFTs = 81;
        address attacker = address(0xbad);
        token.transfer(attacker, 10000e18);

        // Mint 81 NFTs to various holders
        for (uint256 i = 1; i <= totalNFTs; i++) {
            if (i == 1) {
                nft.ownerMint(attacker, i);
            } else {
                nft.ownerMint(user2, i);
            }
        }

        // Fund jar with 81 ETH
        (bool success,) = address(jar).call{value: 81 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Attacker releases once
        vm.startPrank(attacker);
        token.approve(address(jar), BURN_AMOUNT * 100);
        jar.release(assets);
        vm.stopPrank();

        // Attacker's claimable should be exactly 1 ETH (81/81), not 81
        assertEq(jar.claimable(1, assets[0]), 1 ether);

        // Attacker calls release again -- no new funds, so nothing additional
        vm.startPrank(attacker);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.claimable(1, assets[0]), 1 ether);

        // Attacker claims their fair share
        uint256 attackerPre = attacker.balance;
        vm.prank(attacker);
        jar.claim(1, assets);
        assertEq(attacker.balance - attackerPre, 1 ether);

        // Other holders can still claim (spot-check token 2)
        uint256 user2Pre = user2.balance;
        vm.prank(user2);
        jar.claim(2, assets);
        assertEq(user2.balance - user2Pre, 1 ether);

        // Jar still has 79 ETH for the remaining 79 holders
        assertEq(address(jar).balance, 79 ether);
    }

    function testPauseRelease() public {
        nft.ownerMint(user1, 1);
        (bool success,) = address(jar).call{value: 1 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Pause the jar
        jar.pause();

        // Release should revert when paused
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        vm.expectRevert();
        jar.release(assets);
        vm.stopPrank();

        // Unpause
        jar.unpause();

        // Release should succeed now
        vm.startPrank(user1);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.claimable(1, assets[0]), 1 ether);
    }

    function testPauseClaim() public {
        nft.ownerMint(user1, 1);
        (bool success,) = address(jar).call{value: 1 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Release first
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        jar.release(assets);
        vm.stopPrank();

        // Pause
        jar.pause();

        // Claim should revert when paused
        vm.prank(user1);
        vm.expectRevert();
        jar.claim(1, assets);

        // Unpause
        jar.unpause();

        // Claim should succeed now
        uint256 pre = user1.balance;
        vm.prank(user1);
        jar.claim(1, assets);
        assertEq(user1.balance - pre, 1 ether);
    }

    function testEmptyAssetsArray() public {
        nft.ownerMint(user1, 1);
        (bool success,) = address(jar).call{value: 1 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](0);

        // Release with empty array should succeed (burns DAODEGEN, distributes nothing)
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        jar.release(assets);
        vm.stopPrank();

        // Burn should have happened
        assertEq(token.balanceOf(user1), 1000e18 - BURN_AMOUNT);
    }

    function testClaimAfterNFTTransfer() public {
        nft.ownerMint(user1, 1);
        (bool success,) = address(jar).call{value: 1 ether}("");
        require(success);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Release
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.claimable(1, assets[0]), 1 ether);

        // Transfer NFT from user1 to user2
        vm.prank(user1);
        nft.transferFrom(user1, user2, 1);

        // user1 can no longer claim (not owner)
        vm.prank(user1);
        vm.expectRevert(DaoDeGenJar.Unauthorized.selector);
        jar.claim(1, assets);

        // user2 (new owner) can claim
        uint256 pre = user2.balance;
        vm.prank(user2);
        jar.claim(1, assets);
        assertEq(user2.balance - pre, 1 ether);
    }

    function testZeroBurnAmount() public {
        nft.ownerMint(user1, 1);
        (bool success,) = address(jar).call{value: 1 ether}("");
        require(success);

        // Set burn amount to 0
        jar.setBurnAmount(0);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Release should work without any token burn
        vm.prank(user1);
        jar.release(assets);

        assertEq(jar.claimable(1, assets[0]), 1 ether);
        // No tokens burned
        assertEq(token.balanceOf(user1), 1000e18);
    }

    function testDustDistribution() public {
        nft.ownerMint(user1, 1);
        nft.ownerMint(user2, 2);
        
        uint256 reward = 3;
        (bool success,) = address(jar).call{value: reward}("");
        require(success);
        
        vm.startPrank(user1);
        token.approve(address(jar), BURN_AMOUNT);
        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;
        
        jar.release(assets);
        vm.stopPrank();
        
        // user1 (ID 1) should get 1
        // user2 (ID 2) should get 1 + 1 (remainder) = 2
        assertEq(jar.claimable(1, assets[0]), 1);
        assertEq(jar.claimable(2, assets[0]), 2);
    }
}
