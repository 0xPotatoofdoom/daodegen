// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {Currency} from "v4-core/types/Currency.sol";

// Simple ERC20 for rewards
contract RewardToken is ERC20 {
    constructor() ERC20("Reward", "RWD", 18) {}
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract DosReceiver {
    // This contract can receive NFTs
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
    // This contract cannot receive ETH and will revert (no receive/fallback)
}

contract GasBenchmarkTest is Test {
    DaoDeGenJar jar;
    DaoDeGenToken token;
    VerseNFT nft;
    RewardToken rewardToken;
    DosReceiver badActor;

    function setUp() public {
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("ipfs://test", 0, 0, 0); // Free mint for test
        jar = new DaoDeGenJar(address(token), address(nft), 0); // No burn required
        rewardToken = new RewardToken();
        badActor = new DosReceiver();

        // Give jar some rewards
        rewardToken.mint(address(jar), 1000 ether);
        vm.deal(address(jar), 1000 ether);
    }

    function test_Jar_Release_GasUsage_FullCapacity() public {
        // Mint all 81 NFTs to separate addresses
        for (uint256 i = 1; i <= 81; i++) {
            address holder = address(uint160(i + 1000));
            nft.ownerMint(holder, i);
        }

        Currency[] memory assets = new Currency[](2);
        assets[0] = Currency.wrap(address(0)); // ETH
        assets[1] = Currency.wrap(address(rewardToken));

        uint256 startGas = gasleft();
        jar.release(assets);
        uint256 usedGas = startGas - gasleft();

        console.log("Gas used for release() with 81 holders and 2 assets:", usedGas);
        
        // This is a "soft" failure to highlight inefficiency
        // In a real RED test, we expect this to fail if we set a strict gas limit
        // For now, let's focus on the DoS vector which is a "hard" failure
    }

    function test_Jar_Release_RevertsWhenTooManyAssets() public {
        nft.ownerMint(address(0x1234), 1);

        // Build an array of MAX_ASSETS + 1 distinct (dummy) currency addresses
        Currency[] memory assets = new Currency[](11);
        for (uint256 i = 0; i < 11; i++) {
            assets[i] = Currency.wrap(address(uint160(i + 1)));
        }

        vm.expectRevert(DaoDeGenJar.TooManyAssets.selector);
        jar.release(assets);
    }

    function test_Jar_Release_BrickedByRevertingReceiver() public {
        // Mint 80 good holders
        for (uint256 i = 1; i <= 80; i++) {
            address holder = address(uint160(i + 1000));
            nft.ownerMint(holder, i);
        }

        // Mint 1 bad holder (contract that reverts on receive)
        nft.ownerMint(address(badActor), 81);

        Currency[] memory assets = new Currency[](1);
        assets[0] = Currency.wrap(address(0)); // ETH

        // THE RED TEST:
        // Current implementation is "Push", so this SHOULD FAIL because of one bad actor.
        // A production-grade implementation ("Pull" or Merkle) SHOULD SUCCEED for everyone else.
        // Thus, we expect it NOT to revert if it was safe.
        // Since it currently reverts, this test will fail to meet the "must succeed" requirement.
        
        jar.release(assets); 
    }
}