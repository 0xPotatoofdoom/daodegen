// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {SafeCast} from "v4-core/libraries/SafeCast.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";

/// @title DaoDeGenHook
/// @notice V4 afterSwap hook — routes 1% of swap output to DaoDeGenJar immediately.
///
/// Key design:
///   - AFTER_SWAP_RETURNS_DELTA_FLAG (bit 2) set on hook address.
///   - afterSwap() returns feeAmount as hookDeltaUnspecified → PoolManager credits
///     hook with +feeAmount of the output currency.
///   - Within the same afterSwap call (same unlock context), manager.take() is called
///     to claim that credit and clear the hook's delta to zero.
///   - Tokens are forwarded to DaoDeGenJar immediately.
///   - V4 transient storage is tx-scoped, so the take() MUST happen in the same unlock.
contract DaoDeGenHook is IHooks, IUnlockCallback {
    using SafeCast for uint256;
    using SafeCast for int128;
    using CurrencyLibrary for Currency;

    IPoolManager public immutable manager;
    address public immutable jar;
    address public immutable owner;
    bool public paused;
    uint256 public constant FEE_BPS = 100;   // 1%
    uint256 public constant TOTAL_BPS = 10000;

    /// @notice Timelock delay for non-emergency pause changes (unpause).
    uint256 public constant TIMELOCK_DELAY = 2 days;

    /// @notice Timestamp when a pause state change was scheduled (0 = none pending).
    uint256 public pauseScheduledAt;

    /// @notice The pause value that was scheduled.
    bool public scheduledPauseValue;

    error OnlyPoolManager();
    error InvalidAddress();
    error HookPaused();
    error NotOwner();
    error NoPauseScheduled();
    error TimelockNotExpired();

    event PauseScheduled(bool paused, uint256 executeAfter);
    event HookPauseChanged(bool paused);
    event FeesAccrued(Currency indexed currency, uint256 amount);

    modifier whenNotPaused() {
        if (paused) revert HookPaused();
        _;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(manager)) revert OnlyPoolManager();
        _;
    }

    constructor(IPoolManager _poolManager, address _jar) {
        if (address(_poolManager) == address(0) || _jar == address(0)) revert InvalidAddress();
        manager = _poolManager;
        jar = _jar;
        owner = msg.sender;
    }

    /// @notice Schedule a pause state change. Emergency pauses (paused=true) execute
    ///         instantly. Unpauses require a 2-day timelock so users can react.
    /// @param _paused The desired pause state.
    function schedulePause(bool _paused) external {
        if (msg.sender != owner) revert NotOwner();

        // Emergency pause: execute immediately, no timelock needed.
        if (_paused) {
            paused = true;
            pauseScheduledAt = 0;
            emit HookPauseChanged(true);
            return;
        }

        // Schedule unpause with timelock
        pauseScheduledAt = block.timestamp;
        scheduledPauseValue = _paused;
        emit PauseScheduled(_paused, block.timestamp + TIMELOCK_DELAY);
    }

    /// @notice Execute a previously scheduled pause state change after the timelock.
    function executePause() external {
        if (msg.sender != owner) revert NotOwner();
        if (pauseScheduledAt == 0) revert NoPauseScheduled();
        if (block.timestamp < pauseScheduledAt + TIMELOCK_DELAY) revert TimelockNotExpired();

        paused = scheduledPauseValue;
        pauseScheduledAt = 0;
        emit HookPauseChanged(scheduledPauseValue);
    }

    // ── Hook callbacks ──────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external pure override returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external pure override returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external pure override returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    /// @notice After swap — take 1% fee from the output token and forward to jar.
    ///
    /// Flow:
    ///   1. Pool calls afterSwap with swap delta.
    ///   2. Hook calculates feeAmount = 1% of output.
    ///   3. Hook returns feeAmount as hookDeltaUnspecified → PoolManager credits hook +feeAmount.
    ///   4. Hook calls manager.take() to claim that credit immediately (clears hook delta to 0).
    ///   5. Hook forwards tokens to jar.
    ///   6. Swap caller receives output minus feeAmount (delta reduced by pool manager).
    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager whenNotPaused returns (bytes4, int128) {
        // Determine which token is the unspecified (output) token
        bool specifiedTokenIs0 = (params.amountSpecified < 0 == params.zeroForOne);
        (Currency feeCurrency, int128 swapAmount) =
            specifiedTokenIs0 ? (key.currency1, delta.amount1()) : (key.currency0, delta.amount0());

        // Guard against edge cases
        if (swapAmount == type(int128).min) return (IHooks.afterSwap.selector, 0);
        if (swapAmount < 0) swapAmount = -swapAmount;
        if (swapAmount == 0) return (IHooks.afterSwap.selector, 0);

        uint256 feeAmount = uint256(uint128(swapAmount)) * FEE_BPS / TOTAL_BPS;
        if (feeAmount == 0) return (IHooks.afterSwap.selector, 0);

        // Claim the delta credit that PoolManager will assign this hook
        // (must happen in this unlock — transient storage is tx-scoped)
        manager.take(feeCurrency, address(this), feeAmount);

        // Forward to jar immediately
        if (feeCurrency.isAddressZero()) {
            // slither-disable-next-line arbitrary-send-eth
            (bool ok,) = jar.call{value: feeAmount}("");
            require(ok, "ETH to jar failed");
        } else {
            feeCurrency.transfer(jar, feeAmount);
        }

        emit FeesAccrued(feeCurrency, feeAmount);

        // Return fee delta — PoolManager credits hook's account; take() above clears it
        return (IHooks.afterSwap.selector, feeAmount.toInt128());
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }

    // ── IUnlockCallback stub ────────────────────────────────────
    // Not used for fee routing (fees go direct in afterSwap); kept for interface compliance.
    function unlockCallback(bytes calldata) external override returns (bytes memory) {
        if (msg.sender != address(manager)) revert OnlyPoolManager();
        return "";
    }

    receive() external payable {}
}
