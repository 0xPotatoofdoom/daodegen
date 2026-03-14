// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";

contract DaoDeGenTokenTest is Test {
    DaoDeGenToken public token;
    address public owner;
    address public user1;
    address public user2;
    
    uint256 constant MAX_SUPPLY = 81_000_000e18; // 81M tokens
    
    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        token = new DaoDeGenToken(owner);
    }
    
    function testInitialState() public {
        assertEq(token.name(), "Dao DeGen");
        assertEq(token.symbol(), "DAODEGEN");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), MAX_SUPPLY);
        assertEq(token.balanceOf(owner), MAX_SUPPLY);
        assertEq(token.MAX_SUPPLY(), MAX_SUPPLY);
    }
    
    function testTransfer() public {
        uint256 transferAmount = 1000e18;
        
        // Transfer to user1
        bool success = token.transfer(user1, transferAmount);
        assertTrue(success);
        
        assertEq(token.balanceOf(owner), MAX_SUPPLY - transferAmount);
        assertEq(token.balanceOf(user1), transferAmount);
    }
    
    function testTransferFrom() public {
        uint256 allowanceAmount = 2000e18;
        uint256 transferAmount = 1000e18;
        
        // Owner approves user1 to spend tokens
        token.approve(user1, allowanceAmount);
        assertEq(token.allowance(owner, user1), allowanceAmount);
        
        // user1 transfers tokens from owner to user2
        vm.prank(user1);
        bool success = token.transferFrom(owner, user2, transferAmount);
        assertTrue(success);
        
        assertEq(token.balanceOf(owner), MAX_SUPPLY - transferAmount);
        assertEq(token.balanceOf(user2), transferAmount);
        assertEq(token.allowance(owner, user1), allowanceAmount - transferAmount);
    }
    
    function testBurn() public {
        uint256 burnAmount = 1000e18;
        uint256 initialSupply = token.totalSupply();
        
        // Burn tokens from owner's balance
        token.burn(burnAmount);
        
        assertEq(token.totalSupply(), initialSupply - burnAmount);
        assertEq(token.balanceOf(owner), MAX_SUPPLY - burnAmount);
    }
    
    function testBurnFrom() public {
        uint256 allowanceAmount = 2000e18;
        uint256 burnAmount = 1000e18;
        
        // Transfer some tokens to user1 first
        token.transfer(user1, allowanceAmount);
        
        // user1 approves owner to burn their tokens
        vm.prank(user1);
        token.approve(owner, allowanceAmount);
        
        uint256 initialSupply = token.totalSupply();
        uint256 user1InitialBalance = token.balanceOf(user1);
        
        // Owner burns tokens from user1's balance
        token.burnFrom(user1, burnAmount);
        
        assertEq(token.totalSupply(), initialSupply - burnAmount);
        assertEq(token.balanceOf(user1), user1InitialBalance - burnAmount);
        assertEq(token.allowance(user1, owner), allowanceAmount - burnAmount);
    }
    
    function testBurnExceedsBalance() public {
        uint256 burnAmount = MAX_SUPPLY + 1;
        
        // Should revert when trying to burn more than balance
        vm.expectRevert();
        token.burn(burnAmount);
    }
    
    function testBurnFromInsufficientAllowance() public {
        // Transfer tokens to user1
        token.transfer(user1, 1000e18);
        
        // Try to burn without approval
        vm.expectRevert();
        token.burnFrom(user1, 500e18);
    }
    
    function testSupplyMechanics() public {
        // Test that burning actually reduces supply permanently
        uint256 initialSupply = token.totalSupply();
        uint256 burnAmount1 = 1000e18;
        uint256 burnAmount2 = 500e18;
        
        token.burn(burnAmount1);
        assertEq(token.totalSupply(), initialSupply - burnAmount1);
        
        token.burn(burnAmount2);
        assertEq(token.totalSupply(), initialSupply - burnAmount1 - burnAmount2);
        
        // Verify total burned amount
        uint256 totalBurned = burnAmount1 + burnAmount2;
        assertEq(token.totalSupply(), MAX_SUPPLY - totalBurned);
    }
    
    function testMaxSupplyIsConstant() public {
        // Even after burning, MAX_SUPPLY should remain constant
        token.burn(1000e18);
        assertEq(token.MAX_SUPPLY(), MAX_SUPPLY);
        
        // Burn more
        token.burn(5000e18);
        assertEq(token.MAX_SUPPLY(), MAX_SUPPLY);
    }
    
    function testLargeTransfers() public {
        // Test large transfers (edge case for 81M supply)
        uint256 largeAmount = 10_000_000e18; // 10M tokens
        
        token.transfer(user1, largeAmount);
        assertEq(token.balanceOf(user1), largeAmount);
        assertEq(token.balanceOf(owner), MAX_SUPPLY - largeAmount);
        
        // User1 transfers back
        vm.prank(user1);
        token.transfer(owner, largeAmount);
        assertEq(token.balanceOf(owner), MAX_SUPPLY);
        assertEq(token.balanceOf(user1), 0);
    }
}