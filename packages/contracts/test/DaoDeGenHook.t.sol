// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {DaoDeGenHook} from "../src/DaoDeGenHook.sol";
import {DaoDeGenJar} from "../src/DaoDeGenJar.sol";
import {DaoDeGenToken} from "../src/DaoDeGenToken.sol";
import {VerseNFT} from "../src/VerseNFT.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

/// @title DaoDeGenHookTest
/// @notice Tests for DaoDeGenHook including timelock pause behavior (Issue #257)
contract DaoDeGenHookTest is Test {
    using CurrencyLibrary for Currency;

    DaoDeGenHook hook;
    DaoDeGenJar jar;
    DaoDeGenToken token;
    VerseNFT nft;
    IPoolManager manager;

    function setUp() public {
        token = new DaoDeGenToken(address(this));
        nft = new VerseNFT("ipfs://test", 0, 0, 0);
        jar = new DaoDeGenJar(address(token), address(nft), 0);
        manager = IPoolManager(makeAddr("manager"));
        hook = new DaoDeGenHook(manager, address(jar));
    }

    function test_Hook_AfterSwap_RoutesFees() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-1 ether, 2000 ether);
        uint256 expectedFee = 20 ether;

        vm.mockCall(
            address(manager),
            abi.encodeWithSelector(IPoolManager.take.selector),
            abi.encode()
        );

        vm.prank(address(manager));
        (bytes4 selector, int128 fee) = hook.afterSwap(address(0), key, params, delta, "");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(uint128(fee), expectedFee);
    }

    function test_AfterSwap_MinInt128() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-1 ether, type(int128).min);

        vm.prank(address(manager));
        (bytes4 selector, int128 fee) = hook.afterSwap(address(0), key, params, delta, "");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(fee, 0);
    }

    // -------------------------------------------------------------------------
    // Timelock pause tests (Issue #257)
    // -------------------------------------------------------------------------

    function test_EmergencyPause_Instant() public {
        // Emergency pause should execute immediately — no timelock
        hook.schedulePause(true);
        assertTrue(hook.paused());
        assertEq(hook.pauseScheduledAt(), 0);
    }

    function test_EmergencyPause_BlocksSwaps() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-1 ether, 2000 ether);

        hook.schedulePause(true);

        vm.prank(address(manager));
        vm.expectRevert(DaoDeGenHook.HookPaused.selector);
        hook.afterSwap(address(0), key, params, delta, "");
    }

    function test_Unpause_RequiresTimelock() public {
        // Pause first
        hook.schedulePause(true);
        assertTrue(hook.paused());

        // Schedule unpause
        hook.schedulePause(false);
        assertTrue(hook.paused()); // still paused
        assertGt(hook.pauseScheduledAt(), 0);

        // Cannot execute before timelock expires
        vm.expectRevert(DaoDeGenHook.TimelockNotExpired.selector);
        hook.executePause();

        // Warp past timelock
        vm.warp(block.timestamp + 2 days);

        hook.executePause();
        assertFalse(hook.paused());
        assertEq(hook.pauseScheduledAt(), 0);
    }

    function test_Unpause_CannotExecuteEarly() public {
        hook.schedulePause(true);
        hook.schedulePause(false);

        // Try 1 second before timelock expires
        vm.warp(block.timestamp + 2 days - 1);
        vm.expectRevert(DaoDeGenHook.TimelockNotExpired.selector);
        hook.executePause();
    }

    function test_ExecutePause_RevertsIfNoneScheduled() public {
        vm.expectRevert(DaoDeGenHook.NoPauseScheduled.selector);
        hook.executePause();
    }

    function test_NotOwnerCannotSchedulePause() public {
        address nonOwner = makeAddr("nonOwner");
        vm.prank(nonOwner);
        vm.expectRevert(DaoDeGenHook.NotOwner.selector);
        hook.schedulePause(true);
    }

    function test_NotOwnerCannotExecutePause() public {
        hook.schedulePause(true);
        hook.schedulePause(false);

        vm.warp(block.timestamp + 2 days);

        address nonOwner = makeAddr("nonOwner");
        vm.prank(nonOwner);
        vm.expectRevert(DaoDeGenHook.NotOwner.selector);
        hook.executePause();
    }

    function test_SchedulePause_EmitsEvent() public {
        // Emergency pause emits HookPauseChanged
        vm.expectEmit(true, true, true, true);
        emit DaoDeGenHook.HookPauseChanged(true);
        hook.schedulePause(true);

        // Scheduling unpause emits PauseScheduled
        vm.expectEmit(true, true, true, true);
        emit DaoDeGenHook.PauseScheduled(false, block.timestamp + 2 days);
        hook.schedulePause(false);
    }

    function test_ExecutePause_EmitsEvent() public {
        hook.schedulePause(true);
        hook.schedulePause(false);
        vm.warp(block.timestamp + 2 days);

        vm.expectEmit(true, true, true, true);
        emit DaoDeGenHook.HookPauseChanged(false);
        hook.executePause();
    }

    function test_EmergencyPause_ClearsPendingSchedule() public {
        // Schedule an unpause
        hook.schedulePause(true);
        hook.schedulePause(false);
        assertGt(hook.pauseScheduledAt(), 0);

        // Emergency pause again should clear pending schedule
        hook.schedulePause(true);
        assertEq(hook.pauseScheduledAt(), 0);
        assertTrue(hook.paused());
    }

    function test_FullLifecycle_PauseTimelockUnpause() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-1 ether, 2000 ether);

        vm.mockCall(
            address(manager),
            abi.encodeWithSelector(IPoolManager.take.selector),
            abi.encode()
        );

        // 1. Swaps work initially
        vm.prank(address(manager));
        hook.afterSwap(address(0), key, params, delta, "");

        // 2. Emergency pause — instant
        hook.schedulePause(true);

        vm.prank(address(manager));
        vm.expectRevert(DaoDeGenHook.HookPaused.selector);
        hook.afterSwap(address(0), key, params, delta, "");

        // 3. Schedule unpause — must wait
        hook.schedulePause(false);

        vm.prank(address(manager));
        vm.expectRevert(DaoDeGenHook.HookPaused.selector);
        hook.afterSwap(address(0), key, params, delta, "");

        // 4. After timelock — execute unpause
        vm.warp(block.timestamp + 2 days);
        hook.executePause();

        vm.prank(address(manager));
        (bytes4 selector,) = hook.afterSwap(address(0), key, params, delta, "");
        assertEq(selector, IHooks.afterSwap.selector);
    }

    function test_TimelockDelayIs2Days() public view {
        assertEq(hook.TIMELOCK_DELAY(), 2 days);
    }

    // -------------------------------------------------------------------------
    // Pure pass-through callbacks — selector correctness
    // -------------------------------------------------------------------------

    function test_PureCallbacks_ReturnCorrectSelectors() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        ModifyLiquidityParams memory modParams = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: 1000,
            salt: bytes32(0)
        });

        BalanceDelta zeroDelta = toBalanceDelta(0, 0);

        assertEq(hook.afterInitialize(address(0), key, 0, 0),                                     IHooks.afterInitialize.selector);
        assertEq(hook.beforeAddLiquidity(address(0), key, modParams, ""),                          IHooks.beforeAddLiquidity.selector);
        (bytes4 sel,) = hook.afterAddLiquidity(address(0), key, modParams, zeroDelta, zeroDelta, "");
        assertEq(sel,                                                                               IHooks.afterAddLiquidity.selector);
        assertEq(hook.beforeRemoveLiquidity(address(0), key, modParams, ""),                       IHooks.beforeRemoveLiquidity.selector);
        (sel,) = hook.afterRemoveLiquidity(address(0), key, modParams, zeroDelta, zeroDelta, "");
        assertEq(sel,                                                                               IHooks.afterRemoveLiquidity.selector);
        (sel,,) = hook.beforeSwap(address(0), key, SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: 0}), "");
        assertEq(sel,                                                                               IHooks.beforeSwap.selector);
        assertEq(hook.beforeDonate(address(0), key, 0, 0, ""),                                    IHooks.beforeDonate.selector);
    }

    // -------------------------------------------------------------------------
    // ETH fee routing path in afterSwap (feeCurrency = address(0))
    // -------------------------------------------------------------------------

    function test_AfterSwap_ETHFeeAccrues() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: false,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(2000 ether, -1 ether);
        uint256 expectedFee = 20 ether;

        // Mock manager.take() and fund the hook with ETH for forwarding to jar
        vm.mockCall(
            address(manager),
            abi.encodeWithSelector(IPoolManager.take.selector),
            abi.encode()
        );
        vm.deal(address(hook), expectedFee);

        vm.prank(address(manager));
        (bytes4 selector, int128 feeReturned) = hook.afterSwap(address(0), key, params, delta, "");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(uint128(feeReturned), expectedFee);
        assertEq(address(jar).balance, expectedFee);
    }

    // -------------------------------------------------------------------------
    // rescueETH tests (Issue #307)
    // -------------------------------------------------------------------------

    function test_RescueETH_OwnerCanRecover() public {
        vm.deal(address(hook), 5 ether);
        address recipient = makeAddr("recipient");

        vm.expectEmit(true, true, true, true);
        emit DaoDeGenHook.ETHRescued(recipient, 5 ether);
        hook.rescueETH(recipient);

        assertEq(address(hook).balance, 0);
        assertEq(recipient.balance, 5 ether);
    }

    function test_RescueETH_RevertsForNonOwner() public {
        vm.deal(address(hook), 1 ether);
        address nonOwner = makeAddr("nonOwner");

        vm.prank(nonOwner);
        vm.expectRevert(DaoDeGenHook.NotOwner.selector);
        hook.rescueETH(makeAddr("recipient"));
    }

    function test_RescueETH_RevertsForZeroAddress() public {
        vm.deal(address(hook), 1 ether);
        vm.expectRevert(DaoDeGenHook.InvalidAddress.selector);
        hook.rescueETH(address(0));
    }

    function test_RescueETH_ZeroBalance() public {
        address recipient = makeAddr("recipient");
        hook.rescueETH(recipient);
        assertEq(recipient.balance, 0);
    }

    function test_Receive_AcceptsETH() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(hook).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(hook).balance, 1 ether);
    }

    function test_AfterSwap_RevertsForNonManager() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-1 ether, 2000 ether);

        address nonManager = makeAddr("notManager");
        vm.prank(nonManager);
        vm.expectRevert(DaoDeGenHook.OnlyPoolManager.selector);
        hook.afterSwap(address(0), key, params, delta, "");
    }
}
