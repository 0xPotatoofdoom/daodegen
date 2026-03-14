// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PrayerBurn} from "../src/PrayerBurn.sol";

/// @title DeployPrayerBurn
/// @notice Standalone deployment script for PrayerBurn contract.
///         Deployed separately from the core contracts because PrayerBurn
///         is an additive feature (does not modify existing contracts).
contract DeployPrayerBurn is Script {
    function run() external {
        uint256 chainId = block.chainid;

        address token;
        address jar;
        uint256 minimumBurn;
        uint256 cooldownPeriod;

        if (chainId == 1301) {
            // Unichain Sepolia
            token = 0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16;
            jar = 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336;
            minimumBurn = 100e18;       // 100 DAODEGEN
            cooldownPeriod = 60;        // 60 seconds
        } else if (chainId == 130) {
            // Unichain Mainnet
            token = vm.envAddress("DAODEGEN_TOKEN");
            jar = vm.envAddress("DAODEGEN_JAR");
            minimumBurn = 100e18;       // 100 DAODEGEN
            cooldownPeriod = 60;        // 60 seconds
        } else {
            revert("Unsupported chain");
        }

        vm.startBroadcast();

        PrayerBurn prayer = new PrayerBurn(token, jar, minimumBurn, cooldownPeriod);

        vm.stopBroadcast();

        console.log("\n=== PRAYERBURN DEPLOYMENT ===");
        console.log("Chain ID:", chainId);
        console.log("PrayerBurn:", address(prayer));
        console.log("Token:", token);
        console.log("Jar:", jar);
        console.log("Minimum burn:", minimumBurn);
        console.log("Cooldown:", cooldownPeriod);
    }
}
