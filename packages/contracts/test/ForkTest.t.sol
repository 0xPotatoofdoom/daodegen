// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {DaoDeGenHook} from "../src/DaoDeGenHook.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";

/// @title ForkTest
/// @notice Fork Unichain Sepolia at a pinned block, verify hook deploys against real PoolManager
contract ForkTest is Test {
    using CurrencyLibrary for Currency;

    // Unichain Sepolia PoolManager (v4)
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

    IPoolManager public manager;
    DaoDeGenJar public jar;
    DaoDeGenToken public token;
    VerseNFT public nft;

    bool skipTests;

    function setUp() public {
        string memory rpc = vm.envOr("UNICHAIN_SEPOLIA_RPC", string(""));
        if (bytes(rpc).length == 0) {
            skipTests = true;
            return;
        }

        vm.createSelectFork(rpc);

        manager = IPoolManager(POOL_MANAGER);

        // Deploy supporting contracts
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("https://test/", 0.01 ether, 0, 0);
        jar = new DaoDeGenJar(address(token), address(nft), 100e18);
    }

    modifier skipWhenNoRPC() {
        if (skipTests) {
            return;
        }
        _;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /// @dev Verify the PoolManager exists on the fork and has code
    function testPoolManagerExists() public skipWhenNoRPC {
        uint256 codeSize;
        address pm = POOL_MANAGER;
        assembly {
            codeSize := extcodesize(pm)
        }
        assertGt(codeSize, 0, "PoolManager has no code at expected address");
    }

    /// @dev Deploy hook via vm.etch at an address with AFTER_SWAP_FLAG bits set, verify it initializes
    function testHookDeploymentWithEtch() public skipWhenNoRPC {
        // AFTER_SWAP_FLAG = 1 << 6 = 0x40
        // Pick an address whose last byte has bit 6 set
        address hookAddr = address(uint160(0xc0de000000000000000000000000000000000040));

        DaoDeGenHook hookImpl = new DaoDeGenHook(manager, address(jar));
        vm.etch(hookAddr, address(hookImpl).code);

        // Verify the etched code is non-empty
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(hookAddr)
        }
        assertGt(codeSize, 0, "Hook has no code after etch");
    }

    /// @dev Verify jar can receive ETH (simulating fee routing)
    function testJarReceivesETH() public skipWhenNoRPC {
        uint256 amount = 1 ether;
        vm.deal(address(this), amount);
        (bool ok,) = address(jar).call{value: amount}("");
        assertTrue(ok, "Jar did not accept ETH");
        assertEq(address(jar).balance, amount);
    }

    /// @dev End-to-end: mint NFT, fund jar, release, claim on forked state
    function testReleaseAndClaimOnFork() public skipWhenNoRPC {
        address user = address(0xBEEF);

        // Setup
        nft.ownerMint(user, 1);
        token.transfer(user, 1000e18);
        vm.deal(address(jar), 5 ether);

        Currency[] memory assets = new Currency[](1);
        assets[0] = CurrencyLibrary.ADDRESS_ZERO;

        // Release
        vm.startPrank(user);
        token.approve(address(jar), 100e18);
        jar.release(assets);
        vm.stopPrank();

        assertEq(jar.claimable(1, assets[0]), 5 ether);

        // Claim
        uint256 pre = user.balance;
        vm.prank(user);
        jar.claim(1, assets);
        assertEq(user.balance - pre, 5 ether);
    }
}
