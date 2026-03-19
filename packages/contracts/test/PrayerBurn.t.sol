// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {PrayerBurn} from "../src/PrayerBurn.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";

contract PrayerBurnTest is Test {
    PrayerBurn public prayer;
    DaoDeGenToken public token;
    DaoDeGenJar public jar;
    VerseNFT public nft;

    address public owner;
    address public user1;
    address public user2;

    uint256 constant MINIMUM_BURN = 100e18;
    uint256 constant COOLDOWN = 60;
    uint256 constant JAR_BURN_AMOUNT = 1000e18;
    uint256 constant USER_BALANCE = 50_000e18;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        token = new DaoDeGenToken(owner);
        nft = new VerseNFT("https://test/", 0.01 ether, 0, 0);
        jar = new DaoDeGenJar(address(token), address(nft), JAR_BURN_AMOUNT);
        prayer = new PrayerBurn(address(token), address(jar), MINIMUM_BURN, COOLDOWN);

        token.transfer(user1, USER_BALANCE);
        token.transfer(user2, USER_BALANCE);
    }

    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function testConstructor() public view {
        assertEq(address(prayer.daodegen()), address(token));
        assertEq(address(prayer.jar()), address(jar));
        assertEq(prayer.minimumBurn(), MINIMUM_BURN);
        assertEq(prayer.cooldownPeriod(), COOLDOWN);
        assertEq(prayer.releaseThreshold(), 0);
        assertEq(prayer.prayerCount(), 0);
        assertEq(prayer.totalBurned(), 0);
    }

    function testConstructorZeroToken() public {
        vm.expectRevert(PrayerBurn.ZeroAddress.selector);
        new PrayerBurn(address(0), address(jar), MINIMUM_BURN, COOLDOWN);
    }

    function testConstructorZeroJar() public {
        vm.expectRevert(PrayerBurn.ZeroAddress.selector);
        new PrayerBurn(address(token), address(0), MINIMUM_BURN, COOLDOWN);
    }

    // =========================================================================
    // Core prayer
    // =========================================================================

    function testPrayBasic() public {
        uint256 amount = 200e18;
        bytes memory message = "The Tao that can be forked is not the eternal Tao";

        vm.startPrank(user1);
        token.approve(address(prayer), amount);
        prayer.pray(amount, message);
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 1);
        assertEq(prayer.totalBurned(), amount);
        assertEq(token.balanceOf(user1), USER_BALANCE - amount);
    }

    function testPrayEmitsEvent() public {
        uint256 amount = 100e18;
        bytes memory message = "test prayer";

        vm.startPrank(user1);
        token.approve(address(prayer), amount);

        vm.expectEmit(true, false, false, true);
        emit PrayerBurn.Prayer(user1, amount, message);
        prayer.pray(amount, message);
        vm.stopPrank();
    }

    function testPrayEmitsPrayerBurnedWithoutSermonCommitment() public {
        uint256 amount = 100e18;
        bytes memory message = "test prayer";

        vm.startPrank(user1);
        token.approve(address(prayer), amount);

        vm.expectEmit(true, false, false, true);
        emit PrayerBurn.PrayerBurned(user1, amount, bytes32(0));
        prayer.pray(amount, message);
        vm.stopPrank();
    }

    function testPraySilentBurn() public {
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 1);
    }

    function testTokensActuallyBurned() public {
        uint256 supplyBefore = token.totalSupply();
        uint256 amount = 500e18;

        vm.startPrank(user1);
        token.approve(address(prayer), amount);
        prayer.pray(amount, "burn it all");
        vm.stopPrank();

        assertEq(token.totalSupply(), supplyBefore - amount);
    }

    // =========================================================================
    // Minimum burn enforcement
    // =========================================================================

    function testPrayRevertsUnderMinimum() public {
        uint256 amount = 50e18;

        vm.startPrank(user1);
        token.approve(address(prayer), amount);

        vm.expectRevert(abi.encodeWithSelector(PrayerBurn.InsufficientBurn.selector, amount, MINIMUM_BURN));
        prayer.pray(amount, "");
        vm.stopPrank();
    }

    function testPrayExactMinimum() public {
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 1);
    }

    function testPrayLargeAmount() public {
        uint256 amount = 10_000e18;

        vm.startPrank(user1);
        token.approve(address(prayer), amount);
        prayer.pray(amount, "a generous offering");
        vm.stopPrank();

        assertEq(prayer.totalBurned(), amount);
    }

    // =========================================================================
    // Cooldown
    // =========================================================================

    function testCooldownEnforced() public {
        vm.startPrank(user1);
        token.approve(address(prayer), 200e18);
        prayer.pray(100e18, "first");

        vm.expectRevert();
        prayer.pray(100e18, "too soon");
        vm.stopPrank();
    }

    function testCooldownExpires() public {
        vm.startPrank(user1);
        token.approve(address(prayer), 200e18);
        prayer.pray(100e18, "first");
        vm.stopPrank();

        vm.warp(block.timestamp + COOLDOWN + 1);

        vm.startPrank(user1);
        prayer.pray(100e18, "second");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 2);
    }

    function testCooldownExactBoundary() public {
        vm.startPrank(user1);
        token.approve(address(prayer), 200e18);
        prayer.pray(100e18, "first");
        vm.stopPrank();

        // Exactly at cooldown -- should succeed (cooldown is <, not <=)
        vm.warp(block.timestamp + COOLDOWN);

        vm.startPrank(user1);
        prayer.pray(100e18, "exactly at boundary");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 2);
    }

    function testDifferentAddressesNoCooldown() public {
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "from user1");
        vm.stopPrank();

        vm.startPrank(user2);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "from user2");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 2);
    }

    // =========================================================================
    // Message length
    // =========================================================================

    function testMessageTooLong() public {
        bytes memory longMessage = new bytes(1025);

        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);

        vm.expectRevert(abi.encodeWithSelector(PrayerBurn.MessageTooLong.selector, 1025, 1024));
        prayer.pray(MINIMUM_BURN, longMessage);
        vm.stopPrank();
    }

    function testMessageExactLimit() public {
        bytes memory maxMessage = new bytes(1024);

        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, maxMessage);
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 1);
    }

    // =========================================================================
    // Counters
    // =========================================================================

    function testCountersIncrement() public {
        vm.startPrank(user1);
        token.approve(address(prayer), 500e18);

        prayer.pray(100e18, "one");
        vm.warp(block.timestamp + COOLDOWN + 1);
        prayer.pray(150e18, "two");
        vm.warp(block.timestamp + COOLDOWN + 1);
        prayer.pray(250e18, "three");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 3);
        assertEq(prayer.totalBurned(), 500e18);
    }

    function testLastPrayerTimestamp() public {
        uint256 t = block.timestamp;

        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "");
        vm.stopPrank();

        assertEq(prayer.lastPrayer(user1), t);
    }

    // =========================================================================
    // Admin
    // =========================================================================

    function testSetMinimumBurn() public {
        prayer.setMinimumBurn(500e18);
        assertEq(prayer.minimumBurn(), 500e18);
    }

    function testSetMinimumBurnOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        prayer.setMinimumBurn(500e18);
    }

    function testSetCooldownPeriod() public {
        prayer.setCooldownPeriod(120);
        assertEq(prayer.cooldownPeriod(), 120);
    }

    function testSetCooldownPeriodOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        prayer.setCooldownPeriod(120);
    }

    function testSetReleaseThreshold() public {
        prayer.setReleaseThreshold(1 ether);
        assertEq(prayer.releaseThreshold(), 1 ether);
    }

    function testSetReleaseThresholdOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        prayer.setReleaseThreshold(1 ether);
    }

    // =========================================================================
    // Release integration
    // =========================================================================

    function testReleaseDisabledByDefault() public {
        // releaseThreshold = 0 means auto-release is off
        // Prayer should succeed without attempting release
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "no release");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 1);
    }

    function testAutoReleaseTriggered() public {
        // Setup: mint an NFT, fund jar with ETH, fund PrayerBurn with tokens
        nft.ownerMint(user1, 1);

        (bool ok,) = address(jar).call{value: 2 ether}("");
        require(ok);

        // Set jar burn amount to 0 so PrayerBurn doesn't need tokens for release
        jar.scheduleBurnAmount(0);
        vm.warp(block.timestamp + 2 days);
        jar.executeBurnAmount();

        // Enable auto-release with 1 ether threshold
        prayer.setReleaseThreshold(1 ether);

        // Pray
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "trigger release");
        vm.stopPrank();

        // Verify: jar distributed the 2 ETH to token 1
        Currency ethCurrency = CurrencyLibrary.ADDRESS_ZERO;
        assertEq(jar.claimable(1, ethCurrency), 2 ether);
    }

    function testAutoReleaseWithFundedContract() public {
        // Setup: mint NFT, fund jar
        nft.ownerMint(user1, 1);

        (bool ok,) = address(jar).call{value: 2 ether}("");
        require(ok);

        // Jar burn amount stays at 1000e18.
        // Fund PrayerBurn with tokens for the release cost
        token.transfer(address(prayer), JAR_BURN_AMOUNT);
        prayer.approveJar();

        // Enable auto-release
        prayer.setReleaseThreshold(1 ether);

        // Pray
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "funded release");
        vm.stopPrank();

        // Verify release happened
        Currency ethCurrency = CurrencyLibrary.ADDRESS_ZERO;
        assertEq(jar.claimable(1, ethCurrency), 2 ether);

        // Verify PrayerBurn paid the jar burn cost
        assertEq(token.balanceOf(address(prayer)), 0);
    }

    function testAutoReleaseSkippedWhenUnderfunded() public {
        nft.ownerMint(user1, 1);

        (bool ok,) = address(jar).call{value: 2 ether}("");
        require(ok);

        // Enable auto-release but don't fund PrayerBurn
        // Jar burn amount is 1000e18, PrayerBurn has 0 tokens
        prayer.setReleaseThreshold(1 ether);

        // Prayer should still succeed (release silently skipped)
        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "underfunded");
        vm.stopPrank();

        assertEq(prayer.prayerCount(), 1);

        // Jar fees NOT distributed
        Currency ethCurrency = CurrencyLibrary.ADDRESS_ZERO;
        assertEq(jar.claimable(1, ethCurrency), 0);
    }

    function testAutoReleaseSkippedBelowThreshold() public {
        nft.ownerMint(user1, 1);
        jar.scheduleBurnAmount(0);
        vm.warp(block.timestamp + 2 days);
        jar.executeBurnAmount();

        // Fund jar with only 0.5 ether (below 1 ether threshold)
        (bool ok,) = address(jar).call{value: 0.5 ether}("");
        require(ok);

        prayer.setReleaseThreshold(1 ether);

        vm.startPrank(user1);
        token.approve(address(prayer), MINIMUM_BURN);
        prayer.pray(MINIMUM_BURN, "below threshold");
        vm.stopPrank();

        // No release
        Currency ethCurrency = CurrencyLibrary.ADDRESS_ZERO;
        assertEq(jar.claimable(1, ethCurrency), 0);
    }

    // =========================================================================
    // Edge cases
    // =========================================================================

    function testPrayRevertsWithoutApproval() public {
        vm.prank(user1);
        vm.expectRevert();
        prayer.pray(MINIMUM_BURN, "no approval");
    }

    function testPrayRevertsWithInsufficientBalance() public {
        address broke = makeAddr("broke");

        vm.startPrank(broke);
        token.approve(address(prayer), MINIMUM_BURN);
        vm.expectRevert();
        prayer.pray(MINIMUM_BURN, "no tokens");
        vm.stopPrank();
    }

    function testApproveJarAnyone() public {
        // Anyone can call approveJar -- it just approves the jar to spend
        // PrayerBurn's tokens, which is harmless
        vm.prank(user1);
        prayer.approveJar();
    }
}
