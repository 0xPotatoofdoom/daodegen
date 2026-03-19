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
            // Unichain Sepolia (v4 deploy 2026-03-19)
            token = 0x40e2809DDFD640A710308E492F8CFF0d8A81544A;
            jar = 0x5b9adbf87E37661bdA99B0a054485b01e44f3A0d;
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
