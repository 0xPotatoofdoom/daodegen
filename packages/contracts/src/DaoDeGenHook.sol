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

/// @title DaoDeGenHook
/// @notice V4 afterSwap hook — routes a portion of swap output to the DaoDeGenJar
contract DaoDeGenHook is IHooks {
    using SafeCast for uint256;
    using SafeCast for int128;
    using CurrencyLibrary for Currency;
    
    IPoolManager public immutable manager;
    address public immutable jar;
    address public immutable owner;
    bool public paused;
    uint256 public constant FEE_BPS = 100; // 1% fee
    uint256 public constant TOTAL_BPS = 10000;

    error OnlyPoolManager();
    error InvalidAddress();
    error HookPaused();
    error NotOwner();

    event HookPauseChanged(bool paused);

    modifier whenNotPaused() {
        if (paused) revert HookPaused();
        _;
    }

    constructor(IPoolManager _poolManager, address _jar) {
        if (address(_poolManager) == address(0) || _jar == address(0)) revert InvalidAddress();
        manager = _poolManager;
        jar = _jar;
        owner = msg.sender;
    }

    function setPaused(bool _paused) external {
        if (msg.sender != owner) revert NotOwner();
        paused = _paused;
        emit HookPauseChanged(_paused);
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(manager)) revert OnlyPoolManager();
        _;
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        pure
        override
        returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        pure
        override
        returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager whenNotPaused returns (bytes4, int128) {
        bool specifiedTokenIs0 = (params.amountSpecified < 0 == params.zeroForOne);
        (Currency feeCurrency, int128 swapAmount) =
            (specifiedTokenIs0) ? (key.currency1, delta.amount1()) : (key.currency0, delta.amount0());
            
        if (swapAmount == type(int128).min) return (IHooks.afterSwap.selector, 0);
        if (swapAmount < 0) swapAmount = -swapAmount;
        if (swapAmount == 0) return (IHooks.afterSwap.selector, 0);

        uint256 feeAmount = uint256(uint128(swapAmount)) * FEE_BPS / TOTAL_BPS;
        
        if (feeAmount > 0) {
            manager.take(feeCurrency, address(this), feeAmount);
            
            if (feeCurrency.isAddressZero()) {
                (bool success,) = jar.call{value: feeAmount}("");
                require(success, "ETH transfer failed");
            } else {
                feeCurrency.transfer(jar, feeAmount);
            }
        }
        
        return (IHooks.afterSwap.selector, feeAmount.toInt128());
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return IHooks.afterDonate.selector;
    }

    receive() external payable {}
}