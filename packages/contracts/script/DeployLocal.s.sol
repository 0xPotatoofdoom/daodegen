// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";

/// @title DeployLocal
/// @notice Simple deployment script for local testing (without hook mining)
contract DeployLocal is Script {
    function run() external {
        vm.startBroadcast();
        
        address deployer = msg.sender;
        
        // 1. Deploy Token
        console.log("Deploying DaoDeGenToken...");
        DaoDeGenToken token = new DaoDeGenToken(deployer);
        console.log("DaoDeGenToken deployed at:", address(token));
        
        // 2. Deploy NFT
        console.log("Deploying VerseNFT...");
        VerseNFT nft = new VerseNFT(
            "https://localhost:3000/api/metadata/",
            0.001 ether,
            0.0005 ether,
            0 // No cooldown for local testing
        );
        console.log("VerseNFT deployed at:", address(nft));
        
        // 3. Deploy Jar
        console.log("Deploying DaoDeGenJar...");
        DaoDeGenJar jar = new DaoDeGenJar(
            address(token),
            address(nft),
            100e18 // 100 DAODEGEN burn amount
        );
        console.log("DaoDeGenJar deployed at:", address(jar));
        
        vm.stopBroadcast();
        
        console.log("\n=== LOCAL DEPLOYMENT COMPLETE ===");
        console.log("Token Balance:", token.balanceOf(deployer));
        console.log("NFT Mint Price:", nft.mintPrice());
        console.log("Jar Burn Amount:", jar.burnAmount());
    }
}