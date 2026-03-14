// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SeedPool
/// @notice Initializes the DAODEGEN/ETH V4 pool on Unichain Sepolia and adds initial liquidity.
///
/// Pool parameters:
///   currency0 = ETH (address(0))
///   currency1 = DAODEGEN
///   fee       = 0  (hook takes 1% via DaoDeGenHook — no additional LP fee)
///   tickSpacing = 60
///   hooks     = DaoDeGenHook
///
/// Initial price: 1 ETH = 1,000,000 DAODEGEN
///   sqrtPriceX96 = sqrt(1_000_000) * 2^96 = 1000 * Q96
///
/// Liquidity: full-range position using ~0.05 ETH + ~50,000 DAODEGEN
///   liquidityDelta ≈ 50e18  (approximation; actual settlement pulls exact amounts)
///
/// Usage:
///   PRIVATE_KEY=0x... forge script packages/contracts/script/SeedPool.s.sol \
///     --rpc-url https://sepolia.unichain.org --broadcast -vvvv
contract SeedPool is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;

    // ── Unichain Sepolia addresses ──────────────────────────────────────────
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    address       constant DAODEGEN    = 0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16;
    address       constant HOOK        = 0x86be03d383bB06b8f33Ac79E87BAfd64C9684044;

    // ── Pool parameters ─────────────────────────────────────────────────────
    uint24  constant FEE          = 0;   // pure-hook fee model
    int24   constant TICK_SPACING = 60;

    // sqrtPriceX96 = sqrt(1_000_000) * 2^96  →  price = 1 ETH = 1,000,000 DAODEGEN
    uint160 constant SQRT_PRICE_X96 = 79228162514264337593543950336000; // 1000 * Q96

    // Liquidity delta for full-range position (sized to use ~0.05 ETH / ~50k DAODEGEN)
    int256 constant LIQUIDITY_DELTA = 50e18;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address seeder = vm.addr(privateKey);

        // ── Pre-flight checks ─────────────────────────────────────────────
        uint256 ethBalance    = seeder.balance;
        uint256 tokenBalance  = IERC20(DAODEGEN).balanceOf(seeder);

        console.log("=== SeedPool Pre-flight ===");
        console.log("Seeder:          ", seeder);
        console.log("ETH balance:     ", ethBalance);
        console.log("DAODEGEN balance:", tokenBalance);
        require(ethBalance  >= 0.06 ether,  "Need >= 0.06 ETH (liquidity + gas)");
        require(tokenBalance >= 50_000e18,  "Need >= 50,000 DAODEGEN");

        PoolKey memory key = PoolKey({
            currency0:   CurrencyLibrary.ADDRESS_ZERO,
            currency1:   Currency.wrap(DAODEGEN),
            fee:         FEE,
            tickSpacing: TICK_SPACING,
            hooks:       IHooks(HOOK)
        });

        bytes32 poolId = PoolId.unwrap(key.toId());
        console.log("Pool ID (bytes32):");
        console.logBytes32(poolId);

        // ── Broadcast ─────────────────────────────────────────────────────
        vm.startBroadcast(privateKey);

        // 1. Deploy the V4 liquidity helper (handles unlock callback for us)
        console.log("Deploying PoolModifyLiquidityTest helper...");
        PoolModifyLiquidityTest helper = new PoolModifyLiquidityTest(POOL_MANAGER);
        console.log("Helper deployed at:", address(helper));

        // 2. Approve helper to spend DAODEGEN on our behalf
        IERC20(DAODEGEN).approve(address(helper), type(uint256).max);
        console.log("DAODEGEN approved to helper");

        // 3. Initialize the pool
        console.log("Initializing pool...");
        POOL_MANAGER.initialize(key, SQRT_PRICE_X96);
        console.log("Pool initialized at sqrtPriceX96:", SQRT_PRICE_X96);

        // 4. Add full-range liquidity
        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);
        console.log("Tick range: [minUsable, maxUsable]");

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower:      tickLower,
            tickUpper:      tickUpper,
            liquidityDelta: LIQUIDITY_DELTA,
            salt:           bytes32(0)
        });

        BalanceDelta delta = helper.modifyLiquidity{value: 0.05 ether}(key, params, "");
        console.log("Liquidity added!");
        console.log("  ETH spent:     ", uint256(int256(-delta.amount0())));
        console.log("  DAODEGEN spent:", uint256(int256(-delta.amount1())));

        vm.stopBroadcast();

        // ── Verification ──────────────────────────────────────────────────
        console.log("\n=== Pool State ===");
        (uint160 sqrtPrice, int24 tick,,) = POOL_MANAGER.getSlot0(key.toId());
        console.log("sqrtPriceX96:", sqrtPrice);
        console.log("Current tick:", tick);
        uint128 liquidity = POOL_MANAGER.getLiquidity(key.toId());
        console.log("Total liquidity:", liquidity);

        console.log("\n=== DaoDeGenHook State ===");
        console.log("Hook address:", HOOK);
        console.log("(Hook has_logs and balance will show activity after first swap)");

        console.log("\n=== DONE ===");
        console.log("Pool is live. Run a test swap to verify DaoDeGenHook fires.");
        console.log("Explorer: https://unichain-sepolia.blockscout.com/address/", address(helper));
    }
}
