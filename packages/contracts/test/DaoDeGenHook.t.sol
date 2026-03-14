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
/// @notice RED TEST for Issue #75: Add test coverage for DaoDeGenHook
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
        // Mock a pool key and swap params
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1 ether, // Swap 1 ETH
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-1 ether, 2000 ether); // Swapped 1 ETH for 2000 units of currency1

        // 1% fee of 2000 units = 20 units
        uint256 expectedFee = 20 ether;

        // Mock manager.take() - The hook calls this
        vm.mockCall(
            address(manager),
            abi.encodeWithSelector(IPoolManager.take.selector),
            abi.encode()
        );

        // We expect the hook to call afterSwap and return the selector + fee amount
        vm.prank(address(manager));
        (bytes4 selector, int128 fee) = hook.afterSwap(address(0), key, params, delta, "");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(uint128(fee), expectedFee);

        // Check if fee was actually routed to the jar
        // (Wait, the hook currently doesn't have a way to verify this without real balances)
        // This is a RED test because we want to verify the INTEGRATION between Hook and Jar.
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

        // Create a delta where amount1 is type(int128).min -- the edge case
        BalanceDelta delta = toBalanceDelta(-1 ether, type(int128).min);

        // Should return gracefully (0 fee) instead of reverting
        vm.prank(address(manager));
        (bytes4 selector, int128 fee) = hook.afterSwap(address(0), key, params, delta, "");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(fee, 0);
    }

    function test_HookPause() public {
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

        // Pause the hook
        hook.setPaused(true);

        // afterSwap should revert
        vm.prank(address(manager));
        vm.expectRevert(DaoDeGenHook.HookPaused.selector);
        hook.afterSwap(address(0), key, params, delta, "");

        // Unpause
        hook.setPaused(false);

        // Mock manager.take()
        vm.mockCall(
            address(manager),
            abi.encodeWithSelector(IPoolManager.take.selector),
            abi.encode()
        );

        // Should work now
        vm.prank(address(manager));
        (bytes4 selector,) = hook.afterSwap(address(0), key, params, delta, "");
        assertEq(selector, IHooks.afterSwap.selector);
    }

    function test_NotOwnerCannotPause() public {
        address nonOwner = makeAddr("nonOwner");
        vm.prank(nonOwner);
        vm.expectRevert(DaoDeGenHook.NotOwner.selector);
        hook.setPaused(true);
    }

    function test_SetPausedEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit DaoDeGenHook.HookPauseChanged(true);
        hook.setPaused(true);

        vm.expectEmit(true, true, true, true);
        emit DaoDeGenHook.HookPauseChanged(false);
        hook.setPaused(false);
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

    function test_AfterSwap_ETHFeeRoutesToJar() public {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        // zeroForOne=false + amountSpecified>0 → specifiedTokenIs0 = (false == false) = true... wait:
        // specifiedTokenIs0 = (amountSpecified < 0) == zeroForOne
        // To get feeCurrency = currency0 (ETH): specifiedTokenIs0 must be false
        // specifiedTokenIs0 = false when: (amountSpecified < 0) != zeroForOne
        // e.g. amountSpecified = -1e18 (< 0) and zeroForOne = false → (true != false) → false ✓
        SwapParams memory params = SwapParams({
            zeroForOne: false,
            amountSpecified: -1 ether,
            sqrtPriceLimitX96: 0
        });

        // delta.amount0 = 2000 ether (positive output of ETH), fee = 1% = 20 ether
        BalanceDelta delta = toBalanceDelta(2000 ether, -1 ether);
        uint256 expectedFee = 20 ether;

        // Pre-fund hook with ETH (manager.take is mocked, won't actually send ETH)
        vm.deal(address(hook), expectedFee);

        vm.mockCall(
            address(manager),
            abi.encodeWithSelector(IPoolManager.take.selector),
            abi.encode()
        );

        vm.prank(address(manager));
        (bytes4 selector, int128 feeReturned) = hook.afterSwap(address(0), key, params, delta, "");

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(uint128(feeReturned), expectedFee);
        // Jar received the ETH
        assertEq(address(jar).balance, expectedFee);
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

        // Call from non-manager address should revert
        address nonManager = makeAddr("notManager");
        vm.prank(nonManager);
        vm.expectRevert(DaoDeGenHook.OnlyPoolManager.selector);
        hook.afterSwap(address(0), key, params, delta, "");
    }
}
