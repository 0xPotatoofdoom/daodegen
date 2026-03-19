// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";

/// @title DaoDeGenJar
/// @notice Accumulates swap fees from the hook. NFT holders burn $DAODEGEN to claim.
/// @dev Uses a pull-based pattern to avoid DoS from reverting recipients.
contract DaoDeGenJar is Ownable, ReentrancyGuard, Pausable {
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    IERC20 public immutable daodegen;        // $DAODEGEN token (burned on release)
    IERC721Enumerable public immutable nft;  // VerseNFT (holders receive fees)
    uint256 public burnAmount;               // $DAODEGEN required to trigger release

    // tokenId => asset => amount
    mapping(uint256 => mapping(Currency => uint256)) public claimable;

    // asset => total allocated but not yet claimed (outstanding obligations)
    mapping(Currency => uint256) public outstanding;

    /// @notice Maximum number of assets that can be distributed in a single release() call.
    /// @dev Bounds the O(n²) duplicate-asset check and caps worst-case gas:
    ///      81 holders × MAX_ASSETS × ~20 000 gas/cold SSTORE ≈ 16.2 M gas at Unichain prices.
    ///      See GasBenchmark.t.sol for measured values.
    uint256 public constant MAX_ASSETS = 10;

    /// @notice Timelock delay for burn-amount changes.
    uint256 public constant TIMELOCK_DELAY = 2 days;

    /// @notice Timestamp when a burn-amount change was scheduled (0 = none pending).
    uint256 public burnAmountScheduledAt;

    /// @notice The burn amount that was scheduled.
    uint256 public scheduledBurnAmount;

    error NothingToRelease();
    error Unauthorized();
    error TransferFailed();
    error DuplicateAsset();
    error TooManyAssets();
    error NoBurnAmountScheduled();
    error TimelockNotExpired();

    event BurnAmountScheduled(uint256 newAmount, uint256 executeAfter);
    event BurnAmountChangeCancelled(uint256 cancelledAmount);
    event FeesReleased(address indexed caller, uint256 burnAmount, uint256 nftHolders);
    event BurnAmountUpdated(uint256 newAmount);
    event Claimed(uint256 indexed tokenId, address indexed holder, Currency indexed asset, uint256 amount);

    constructor(
        address _daodegen,
        address _nft,
        uint256 _burnAmount
    ) Ownable(msg.sender) {
        require(_daodegen != address(0), "Invalid token address");
        require(_nft != address(0), "Invalid NFT address");
        daodegen = IERC20(_daodegen);
        nft = IERC721Enumerable(_nft);
        burnAmount = _burnAmount;
    }

    /// @notice Burn $DAODEGEN to distribute accumulated fees to all NFT holders' claimable balances
    /// @param assets Fee tokens to distribute. Must have at most MAX_ASSETS entries (no duplicates).
    /// @dev CEI note: safeTransferFrom (burn) precedes state updates but is safe because
    ///      nonReentrant prevents re-entry, and the external call targets the trusted
    ///      $DAODEGEN token (OZ ERC-20, no hooks). State changes that follow only write
    ///      to claimable/outstanding mappings, which are not read before the burn.
    ///
    ///      Gas ceiling: assets.length is capped at MAX_ASSETS (10). At full capacity
    ///      (81 holders, 10 assets) this is 810 cold SSTOREs (~20 000 gas each) plus
    ///      overhead — roughly 16-18 M gas. See GasBenchmark.t.sol for measured values.
    ///      Callers should budget at least 20 M gas for worst-case invocations.
    function release(Currency[] calldata assets) external nonReentrant whenNotPaused {
        if (assets.length > MAX_ASSETS) revert TooManyAssets();
        uint256 totalNFTs = nft.totalSupply();
        if (totalNFTs == 0) revert NothingToRelease();
        
        if (burnAmount > 0) {
            daodegen.safeTransferFrom(msg.sender, address(0xdead), burnAmount);
        }
        
        for (uint256 i = 0; i < assets.length; i++) {
            Currency asset = assets[i];

            // Reject duplicate assets within a single call
            for (uint256 k = 0; k < i; k++) {
                if (Currency.unwrap(assets[k]) == Currency.unwrap(asset)) {
                    revert DuplicateAsset();
                }
            }

            uint256 balance;

            if (asset.isAddressZero()) {
                balance = address(this).balance;
            } else {
                balance = asset.balanceOfSelf();
            }

            // Only distribute funds not already allocated to holders
            uint256 distributable = balance > outstanding[asset] ? balance - outstanding[asset] : 0;

            // slither-disable-next-line incorrect-equality
            if (distributable == 0) continue;

            uint256 perHolder = distributable / totalNFTs;
            uint256 remainder = distributable % totalNFTs;

            uint256 totalDistributed = 0;
            for (uint256 j = 0; j < totalNFTs; j++) {
                uint256 tokenId = nft.tokenByIndex(j);
                uint256 amount = perHolder;

                if (j == totalNFTs - 1 && remainder > 0) {
                    amount += remainder;
                }

                if (amount > 0) {
                    claimable[tokenId][asset] += amount;
                    totalDistributed += amount;
                }
            }

            outstanding[asset] += totalDistributed;
        }
        
        emit FeesReleased(msg.sender, burnAmount, totalNFTs);
    }

    /// @notice Claim accumulated fees for a specific NFT
    function claim(uint256 tokenId, Currency[] calldata assets) external nonReentrant whenNotPaused {
        address holder = nft.ownerOf(tokenId);
        if (msg.sender != holder) revert Unauthorized();

        for (uint256 i = 0; i < assets.length; i++) {
            Currency asset = assets[i];
            uint256 amount = claimable[tokenId][asset];
            
            if (amount > 0) {
                // CEI: clear state before external call to prevent reentrancy
                claimable[tokenId][asset] = 0;
                outstanding[asset] -= amount;

                emit Claimed(tokenId, holder, asset, amount);

                if (asset.isAddressZero()) {
                    // slither-disable-next-line arbitrary-send-eth
                    (bool success,) = holder.call{value: amount}("");
                    if (!success) revert TransferFailed();
                } else {
                    asset.transfer(holder, amount);
                }
            }
        }
    }

    /// @notice Schedule a burn-amount change. Requires a 2-day timelock.
    /// @param _burnAmount The desired new burn amount.
    function scheduleBurnAmount(uint256 _burnAmount) external onlyOwner {
        burnAmountScheduledAt = block.timestamp;
        scheduledBurnAmount = _burnAmount;
        emit BurnAmountScheduled(_burnAmount, block.timestamp + TIMELOCK_DELAY);
    }

    /// @notice Execute a previously scheduled burn-amount change after the timelock.
    function executeBurnAmount() external onlyOwner {
        if (burnAmountScheduledAt == 0) revert NoBurnAmountScheduled();
        if (block.timestamp < burnAmountScheduledAt + TIMELOCK_DELAY) revert TimelockNotExpired();

        burnAmount = scheduledBurnAmount;
        burnAmountScheduledAt = 0;
        emit BurnAmountUpdated(scheduledBurnAmount);
    }

    /// @notice Cancel a pending burn-amount change.
    function cancelBurnAmount() external onlyOwner {
        if (burnAmountScheduledAt == 0) revert NoBurnAmountScheduled();

        uint256 cancelled = scheduledBurnAmount;
        burnAmountScheduledAt = 0;
        scheduledBurnAmount = 0;
        emit BurnAmountChangeCancelled(cancelled);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Accept ETH fees
    receive() external payable {}
}