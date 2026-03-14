// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {DaoDeGenHook} from "../src/DaoDeGenHook.sol";

/// @title DeployHookOnly
/// @notice Standalone deployment script for redeploying DaoDeGenHook.
///         Uses existing Jar and PoolManager addresses. Mines a new CREATE2
///         address whose least-significant bits satisfy V4 permission flags.
contract DeployHookOnly is Script {
    /// @dev AFTER_SWAP_FLAG (1<<6) | AFTER_SWAP_RETURNS_DELTA_FLAG (1<<2)
    uint160 constant HOOK_FLAGS = 0x44;

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

        // Mine a hook address with correct V4 flags
        console.log("Mining hook address with flags:", uint256(HOOK_FLAGS));
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
        console.log("\nNext steps:");
        console.log("  1. Initialize V4 pool with new hook address");
        console.log("  2. Seed liquidity in the new pool");
        console.log("  3. Drain liquidity from old pool");
        console.log("  4. Update DEPLOYMENT.md with new hook address");
    }

    function mineHookAddress(
        address poolManager,
        address jar
    ) internal view returns (address, bytes32) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(DaoDeGenHook).creationCode,
            abi.encode(poolManager, jar)
        ));

        uint256 nonce = 0;
        while (true) {
            bytes32 salt = keccak256(abi.encodePacked("DaoDeGenHook", nonce));
            address predicted = computeCreate2Address(salt, initCodeHash);

            if (uint160(predicted) & HOOK_FLAGS == HOOK_FLAGS) {
                console.log("  Mined with nonce:", nonce);
                return (predicted, salt);
            }

            nonce++;
            if (nonce > 1000000) {
                revert("Could not mine hook address within 1M iterations");
            }
        }
    }
}
