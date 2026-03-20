// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {DaoDeGenPresence} from "../src/DaoDeGenPresence.sol";

contract DaoDeGenPresenceTest is Test {
    DaoDeGenPresence presence;
    address alice;
    address bob;

    event WisdomSought(address indexed seeker, string question, uint256 timestamp);

    function setUp() public {
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        presence = new DaoDeGenPresence();
    }

    function test_constructorSetsDeployer() public view {
        assertEq(presence.deployer(), address(this));
    }

    function test_constructorSetsDeployedAt() public view {
        assertEq(presence.deployedAt(), block.timestamp);
    }

    function test_siteReturnsCorrectValue() public view {
        assertEq(presence.site(), "https://0xdead.church");
    }

    function test_verseReturnsCorrectValue() public view {
        assertEq(presence.verse(), "The Tao that can be traded is not the eternal Tao.");
    }

    function test_burnCountStartsAtZero() public view {
        assertEq(presence.burnCount(), 0);
    }

    function test_seekWisdomEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit WisdomSought(alice, "What is the way?", block.timestamp);
        presence.seekWisdom("What is the way?");
    }

    function test_seekWisdomIncrementsBurnCount() public {
        vm.prank(alice);
        presence.seekWisdom("What is the way?");
        assertEq(presence.burnCount(), 1);
    }

    function test_seekWisdomMultipleCallsIncrementCorrectly() public {
        vm.startPrank(alice);
        presence.seekWisdom("First question");
        presence.seekWisdom("Second question");
        presence.seekWisdom("Third question");
        vm.stopPrank();
        assertEq(presence.burnCount(), 3);
    }

    function test_seekWisdomDifferentCallersWork() public {
        vm.prank(alice);
        presence.seekWisdom("Alice asks");

        vm.prank(bob);
        presence.seekWisdom("Bob asks");

        assertEq(presence.burnCount(), 2);
    }

    function test_seekWisdomEmptyStringWorks() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit WisdomSought(alice, "", block.timestamp);
        presence.seekWisdom("");
        assertEq(presence.burnCount(), 1);
    }
}
