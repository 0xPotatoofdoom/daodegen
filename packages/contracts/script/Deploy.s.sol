// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenHook} from "../src/DaoDeGenHook.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

/// @title Deploy
/// @notice Deployment script for DaoDeGen contracts
/// @dev Deploy order: Token -> NFT -> Jar -> Hook
///      Hook address needs to be mined for specific permissions prefix
contract Deploy is Script {
    // Deployment configuration
    struct DeployConfig {
        address initialHolder;
        string baseURI;
        uint256 baseMintPrice;
        uint256 priceIncrement;
        uint256 mintCooldown;
        uint256 burnAmount;
        address poolManager;
        uint256 hookFlags;  // Expected hook permissions as uint256
    }

    function run() external {
        // Load deployment config based on chain
        DeployConfig memory config = getDeployConfig();
        
        // Start broadcasting transactions
        vm.startBroadcast();
        
        // 1. Deploy Token
        console.log("Deploying DaoDeGenToken...");
        DaoDeGenToken token = new DaoDeGenToken(config.initialHolder);
        console.log("DaoDeGenToken deployed at:", address(token));
        
        // 2. Deploy NFT
        console.log("Deploying VerseNFT...");
        VerseNFT nft = new VerseNFT(config.baseURI, config.baseMintPrice, config.priceIncrement, config.mintCooldown);
        console.log("VerseNFT deployed at:", address(nft));
        
        // 3. Deploy Jar
        console.log("Deploying DaoDeGenJar...");
        DaoDeGenJar jar = new DaoDeGenJar(
            address(token),
            address(nft), 
            config.burnAmount
        );
        console.log("DaoDeGenJar deployed at:", address(jar));
        
        // 4. Mine Hook address with correct permissions
        console.log("Mining Hook address with permissions:", config.hookFlags);
        address hookAddress = mineHookAddress(
            config.poolManager,
            address(jar),
            config.hookFlags
        );
        
        // 5. Deploy Hook at mined address
        console.log("Deploying DaoDeGenHook at mined address...");
        DaoDeGenHook hook = deployHookAt(
            hookAddress,
            IPoolManager(config.poolManager),
            address(jar)
        );
        console.log("DaoDeGenHook deployed at:", address(hook));

        // 6. Deploy Agent Registry
        console.log("Deploying AgentRegistry...");
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(registry));
        
        vm.stopBroadcast();
        
        // Output summary
        printDeploymentSummary(
            address(token),
            address(nft),
            address(jar),
            address(hook),
            address(registry)
        );
    }
    
    /// @notice Get deployment configuration for current chain
    function getDeployConfig() internal view returns (DeployConfig memory) {
        uint256 chainId = block.chainid;
        
        if (chainId == 1301) { // Unichain Sepolia
            return DeployConfig({
                initialHolder: vm.envAddress("INITIAL_HOLDER"),
                baseURI: "https://daodegen.xyz/api/metadata/",
                baseMintPrice: 0.001 ether,
                priceIncrement: 0.0005 ether,
                mintCooldown: 86400,
                burnAmount: 1000e18, // 1000 DAODEGEN
                poolManager: 0x00B036B58a818B1BC34d502D3fE730Db729e62AC, // V4 Unichain Sepolia PoolManager
                hookFlags: 0x400000 // AFTER_SWAP_FLAG
            });
        } else if (chainId == 130) { // Unichain Mainnet
            return DeployConfig({
                initialHolder: vm.envAddress("INITIAL_HOLDER"),
                baseURI: "https://daodegen.xyz/api/metadata/",
                baseMintPrice: 0.01 ether,
                priceIncrement: 0.005 ether,
                mintCooldown: 86400,
                burnAmount: 10000e18, // 10k DAODEGEN
                poolManager: 0x1F98400000000000000000000000000000000004, // V4 Unichain Mainnet PoolManager
                hookFlags: 0x400000 // AFTER_SWAP_FLAG
            });
        } else {
            revert("Unsupported chain");
        }
    }
    
    /// @notice Mine a hook address with the required permissions prefix
    /// @dev V4 hooks must have addresses that match their permission flags
    function mineHookAddress(
        address poolManager,
        address jar,
        uint256 expectedFlags
    ) internal view returns (address) {
        // Calculate the expected prefix from hook flags
        bytes1 expectedPrefix = bytes1(uint8(expectedFlags >> 152));
        
        // Mine addresses until we find one with the correct prefix
        uint256 nonce = 0;
        while (true) {
            bytes32 salt = keccak256(abi.encodePacked("DaoDeGenHook", nonce));
            address predicted = computeCreate2Address(
                salt,
                keccak256(abi.encodePacked(
                    type(DaoDeGenHook).creationCode,
                    abi.encode(poolManager, jar)
                ))
            );
            
            if (bytes1(bytes20(predicted)) == expectedPrefix) {
                console.log("Found hook address:", predicted, "with salt:", nonce);
                return predicted;
            }
            
            nonce++;
            if (nonce > 100000) {
                revert("Could not mine hook address");
            }
        }
    }
    
    /// @notice Deploy hook at specific address using CREATE2
    function deployHookAt(
        address expectedAddress,
        IPoolManager poolManager,
        address jar
    ) internal returns (DaoDeGenHook) {
        // Find the salt that produces the expected address
        uint256 nonce = 0;
        bytes32 correctSalt;
        
        while (true) {
            bytes32 salt = keccak256(abi.encodePacked("DaoDeGenHook", nonce));
            address predicted = computeCreate2Address(
                salt,
                keccak256(abi.encodePacked(
                    type(DaoDeGenHook).creationCode,
                    abi.encode(poolManager, jar)
                ))
            );
            
            if (predicted == expectedAddress) {
                correctSalt = salt;
                break;
            }
            
            nonce++;
        }
        
        // Deploy with the correct salt
        DaoDeGenHook hook = new DaoDeGenHook{salt: correctSalt}(poolManager, jar);
        require(address(hook) == expectedAddress, "Hook address mismatch");
        
        return hook;
    }
    
    /// @notice Print deployment summary with verification commands
    function printDeploymentSummary(
        address token,
        address nft,
        address jar,
        address hook,
        address registry
    ) internal view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Chain ID:", block.chainid);
        console.log("DaoDeGenToken:", token);
        console.log("VerseNFT:", nft);
        console.log("DaoDeGenJar:", jar);
        console.log("DaoDeGenHook:", hook);
        console.log("AgentRegistry:", registry);
        
        console.log("\n=== ETHERSCAN VERIFICATION ===");
        /*
        console.log("forge verify-contract --chain-id", block.chainid, "--constructor-args $(cast abi-encode \"constructor(address)\" ", msg.sender, ")", token, "src/DaoDeGenToken.sol:DaoDeGenToken");
        console.log("forge verify-contract --chain-id", block.chainid, "--constructor-args $(cast abi-encode \"constructor(string,uint256)\" \"https://daodegen.xyz/api/metadata/\" 1000000000000000)", nft, "src/VerseNFT.sol:VerseNFT");
        console.log("forge verify-contract --chain-id", block.chainid, "--constructor-args $(cast abi-encode \"constructor(address,address,uint256)\" ", token, " ", nft, " 1000000000000000000000)", jar, "src/DaoDeGenJar.sol:DaoDeGenJar");
        */
        // Note: Hook verification will need the exact constructor args with mined salt
    }
}