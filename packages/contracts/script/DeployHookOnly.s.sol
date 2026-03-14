// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {DaoDeGenHook} from "../src/DaoDeGenHook.sol";

/// @title DeployHookOnly
/// @notice Standalone deployment script for redeploying DaoDeGenHook.
///         Uses existing Jar and PoolManager addresses. Mines a new CREATE2
///         address whose least-significant bits EXACTLY match V4 permission flags.
///
/// V4 hook address encoding (lower 14 bits):
///   bit 2: AFTER_SWAP_RETURNS_DELTA_FLAG
///   bit 6: AFTER_SWAP_FLAG
///   All other bits MUST be 0 (extra permission bits trigger callbacks the hook
///   doesn't implement, causing subtle failures).
contract DeployHookOnly is Script {
    /// @dev AFTER_SWAP_FLAG (1<<6) | AFTER_SWAP_RETURNS_DELTA_FLAG (1<<2)
    uint160 constant HOOK_FLAGS = 0x44;
    uint160 constant HOOK_FLAGS_MASK = 0x3FFF; // all 14 permission bits

    function run() external {
        uint256 chainId = block.chainid;

        address poolManager;
        address jar;

        if (chainId == 1301) {
            // Unichain Sepolia
            poolManager = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
            jar = 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336;
        } else if (chainId == 130) {
            // Unichain Mainnet
            poolManager = 0x1F98400000000000000000000000000000000004;
            jar = vm.envAddress("JAR_ADDRESS");
        } else {
            revert("Unsupported chain");
        }

        // Mine a hook address with exact V4 flags
        console.log("Mining hook address with exact flags: 0x44");
        console.log("  (AFTER_SWAP_FLAG | AFTER_SWAP_RETURNS_DELTA_FLAG, no extras)");
        (address hookAddr, bytes32 salt) = mineHookAddress(poolManager, jar);
        console.log("Found hook address:", hookAddr);

        vm.startBroadcast();

        DaoDeGenHook hook = new DaoDeGenHook{salt: salt}(
            IPoolManager(poolManager),
            jar
        );
        require(address(hook) == hookAddr, "Hook address mismatch");

        vm.stopBroadcast();

        console.log("\n=== HOOK DEPLOYMENT ===");
        console.log("Chain ID:", chainId);
        console.log("DaoDeGenHook:", address(hook));
        console.log("PoolManager:", poolManager);
        console.log("Jar:", jar);
        console.log("Low 14 bits:", uint256(uint160(address(hook)) & HOOK_FLAGS_MASK));
        console.log("\nNext steps:");
        console.log("  1. Initialize V4 pool with new hook address");
        console.log("  2. Seed liquidity in the new pool");
        console.log("  3. Drain liquidity from old pool");
        console.log("  4. Update DEPLOYMENT.md with new hook address");
    }

    function mineHookAddress(
        address poolManager,
        address jar
    ) internal returns (address, bytes32) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(DaoDeGenHook).creationCode,
            abi.encode(poolManager, jar)
        ));

        // Foundry routes `new X{salt: ...}(...)` through the deterministic
        // CREATE2 factory at 0x4e59b44847b379578588920cA78FbF26c0B4956C.
        // The actual CREATE2 deployer is that factory, NOT msg.sender.
        address deployer = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        console.log("  Deployer (CREATE2 factory):", deployer);

        uint256 nonce = 0;
        while (true) {
            bytes32 salt = keccak256(abi.encodePacked("DaoDeGenHook", nonce));
            address predicted = vm.computeCreate2Address(salt, initCodeHash, deployer);

            if (uint160(predicted) & HOOK_FLAGS_MASK == HOOK_FLAGS) {
                console.log("  Mined with nonce:", nonce);
                console.log("  Salt:", vm.toString(salt));
                return (predicted, salt);
            }

            nonce++;
            if (nonce > 10_000_000) {
                revert("Could not mine hook address within 10M iterations");
            }
        }
    }
}
