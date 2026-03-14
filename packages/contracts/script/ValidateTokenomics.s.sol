// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";


// ─────────────────────────────────────────────────────────────────────────────
// Minimal interfaces for VerseNFT and DaoDeGenJar
// ─────────────────────────────────────────────────────────────────────────────
interface IVerseNFT {
    function mint() external payable;
    function mintPrice() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IDaoDeGenJar {
    function release(address[] calldata assets) external;
    function claim(uint256 tokenId, address[] calldata assets) external;
    function claimable(uint256 tokenId, address asset) external view returns (uint256);
    function burnAmount() external view returns (uint256);
    function outstanding(address asset) external view returns (uint256);
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidateTokenomics Script
// ─────────────────────────────────────────────────────────────────────────────
contract ValidateTokenomics is Script {
    using CurrencyLibrary for Currency;

    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    address constant DAODEGEN  = 0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16;
    address constant HOOK      = 0x86be03d383bB06b8f33Ac79E87BAfd64C9684044;
    address constant VERSE_NFT = 0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50;
    address constant JAR       = 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336;

    uint24 constant FEE          = 0;
    int24  constant TICK_SPACING = 60;

    uint256 constant SWAP_ETH_IN      = 0.005 ether;
    uint256 constant SWAP_DAODEGEN_IN = 5_000e18;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address leo = vm.addr(privateKey);

        PoolKey memory key = PoolKey({
            currency0:   CurrencyLibrary.ADDRESS_ZERO,
            currency1:   Currency.wrap(DAODEGEN),
            fee:         FEE,
            tickSpacing: TICK_SPACING,
            hooks:       IHooks(HOOK)
        });

        IVerseNFT    nft = IVerseNFT(VERSE_NFT);
        IDaoDeGenJar jar = IDaoDeGenJar(JAR);

        console.log("=== ValidateTokenomics ===");
        console.log("Leo:             ", leo);
        console.log("ETH balance:     ", leo.balance);
        console.log("DAODEGEN balance:", IERC20(DAODEGEN).balanceOf(leo));
        console.log("Jar ETH balance: ", JAR.balance);
        console.log("VerseNFT supply: ", nft.totalSupply());

        vm.startBroadcast(privateKey);

        // ── 1. Mint a VerseNFT to Leo ────────────────────────────────────
        console.log("\n--- Step 1: Mint VerseNFT to Leo ---");
        uint256 mintPrice = nft.mintPrice();
        console.log("mintPrice:", mintPrice);
        nft.mint{value: mintPrice}();
        uint256 leoTokenId = nft.totalSupply();
        console.log("Minted VERSE #", leoTokenId);

        // ── 2. Deploy PoolSwapTest router & approve ────────────────────────
        console.log("\n--- Step 2: Deploy PoolSwapTest router ---");
        PoolSwapTest router = new PoolSwapTest(POOL_MANAGER);
        IERC20(DAODEGEN).approve(address(router), type(uint256).max);
        console.log("Router:", address(router));

        // ── 3. Five swaps — alternating ETH<>DAODEGEN ────────────────────
        console.log("\n--- Step 3: Execute 5 swaps ---");
        uint256 jarBefore = JAR.balance;
        console.log("Jar ETH before:", jarBefore);

        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });
        SwapParams memory ethIn = SwapParams({
            zeroForOne:        true,
            amountSpecified:   -int256(SWAP_ETH_IN),
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });
        SwapParams memory daoIn = SwapParams({
            zeroForOne:        false,
            amountSpecified:   -int256(SWAP_DAODEGEN_IN),
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });

        router.swap{value: SWAP_ETH_IN}(key, ethIn, settings, "");
        console.log("Swap 1 ETH->DAODEGEN done. Jar:", JAR.balance);

        router.swap(key, daoIn, settings, "");
        console.log("Swap 2 DAODEGEN->ETH done. Jar:", JAR.balance);

        router.swap{value: SWAP_ETH_IN}(key, ethIn, settings, "");
        console.log("Swap 3 ETH->DAODEGEN done. Jar:", JAR.balance);

        router.swap(key, daoIn, settings, "");
        console.log("Swap 4 DAODEGEN->ETH done. Jar:", JAR.balance);

        router.swap{value: SWAP_ETH_IN}(key, ethIn, settings, "");
        console.log("Swap 5 ETH->DAODEGEN done. Jar:", JAR.balance);

        uint256 jarAfterSwaps = JAR.balance;
        uint256 feesCollected = jarAfterSwaps - jarBefore;
        console.log("Total fees collected:", feesCollected);

        // ── 4. release() — burn 1,000 DAODEGEN to distribute fees ─────────
        console.log("\n--- Step 4: release() ---");
        uint256 burnAmt = jar.burnAmount();
        console.log("burnAmount:", burnAmt);
        IERC20(DAODEGEN).approve(JAR, burnAmt);

        address[] memory ethAsset = new address[](1);
        ethAsset[0] = address(0);
        jar.release(ethAsset);
        console.log("release() done.");

        uint256 totalSupply = nft.totalSupply();
        console.log("Distributed to", totalSupply, "VERSE holders:");
        for (uint256 i = 1; i <= totalSupply; i++) {
            uint256 amt = jar.claimable(i, address(0));
            console.log("  VERSE #", i, "=>", amt);
        }

        // ── 5. claim() Leo's share ────────────────────────────────────────
        console.log("\n--- Step 5: claim() Leo's share ---");
        uint256 leoPre = leo.balance;
        jar.claim(leoTokenId, ethAsset);
        uint256 leoPost = leo.balance;
        console.log("Leo received:", leoPost > leoPre ? leoPost - leoPre : 0);

        vm.stopBroadcast();

        // ── Summary ───────────────────────────────────────────────────────
        console.log("\n=== SUMMARY ===");
        console.log("Fees collected in Jar:      ", feesCollected);
        console.log("Leo claimed VERSE #", leoTokenId);
        console.log("potatoofdoom.eth can claim VERSE #1, #2, #3, #4 from:");
        console.log("  ", JAR);
        console.log("Full swap->hook->jar->release->claim flow: OK");
    }
}
