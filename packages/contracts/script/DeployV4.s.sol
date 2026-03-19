// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PrayerBurn} from "../src/PrayerBurn.sol";
import {SermonCommitment} from "../src/SermonCommitment.sol";

contract DeployV4 is Script {
    function run() external {
        vm.startBroadcast();
        address token  = vm.envAddress("NEW_TOKEN");
        address jar    = vm.envAddress("NEW_JAR");
        address pastor = msg.sender;

        PrayerBurn pb = new PrayerBurn(token, jar, 100e18, 60);
        console.log("PrayerBurn:", address(pb));

        SermonCommitment sc = new SermonCommitment(pastor, address(pb));
        console.log("SermonCommitment:", address(sc));

        pb.setSermonCommitment(address(sc));
        console.log("SermonCommitment linked");

        pb.setReleaseThreshold(100000000000000);
        console.log("releaseThreshold set to 0.0001 ETH");

        vm.stopBroadcast();
    }
}
