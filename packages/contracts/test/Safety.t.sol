// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {DaoDeGenHook} from "../src/DaoDeGenHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// @title SafetyTest
/// @notice Tests for safety invariants and input validation (e.g. zero address checks)
contract SafetyTest is Test {
    DaoDeGenToken token;
    VerseNFT nft;
    IPoolManager manager;

    function setUp() public {
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("ipfs://test", 0.01 ether, 0, 0);
        manager = IPoolManager(makeAddr("manager"));
    }

    // --- DaoDeGenToken ---

    function test_Token_RevertsOnZeroHolder() public {
        vm.expectRevert("Invalid holder address");
        new DaoDeGenToken(address(0));
    }

    // --- DaoDeGenJar ---

    function test_Jar_RevertsOnZeroToken() public {
        vm.expectRevert("Invalid token address");
        new DaoDeGenJar(address(0), address(nft), 100);
    }

    function test_Jar_RevertsOnZeroNFT() public {
        vm.expectRevert("Invalid NFT address");
        new DaoDeGenJar(address(token), address(0), 100);
    }

    // --- DaoDeGenHook ---

    error InvalidAddress();

    function test_Hook_RevertsOnZeroManager() public {
        vm.expectRevert(InvalidAddress.selector);
        new DaoDeGenHook(IPoolManager(address(0)), address(token));
    }

    function test_Hook_RevertsOnZeroJar() public {
        vm.expectRevert(InvalidAddress.selector);
        new DaoDeGenHook(manager, address(0));
    }
}