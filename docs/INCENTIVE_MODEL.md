# Incentive Model

Every state-changing function in the Dao DeGen protocol and who is incentivised to call it.

## Function Reference

| Function | Contract | Caller | Incentive | Breaks if uncalled? |
|---|---|---|---|---|
| `afterSwap` | DaoDeGenHook | PoolManager (automatic) | Implicit -- fires on every swap through the hooked pool | No -- only fires on swaps |
| `release(assets)` | DaoDeGenJar | Anyone | Must burn `$DAODEGEN` to trigger | Yes -- fees accumulate in Jar forever |
| `claim(tokenId, assets)` | DaoDeGenJar | NFT holder (owner of `tokenId`) | Receives proportional share of released fees | No -- funds stay allocated in `claimable` |
| `mint()` | VerseNFT | Users | Receives NFT + future fee rights | No -- supply stays lower |
| `register(metadataURI)` | AgentRegistry | Agents | Gets on-chain identity (soulbound NFT) | No -- registry stays smaller |

## Key Design Assumptions

### `release()` has a cost but no direct reward

Calling `release()` burns `$DAODEGEN` tokens (sent to `0xdead`) but does not directly pay the caller. Instead, it distributes accumulated fees across **all** NFT holders' `claimable` balances. This means:

- **NFT holders are the natural callers** -- they burn tokens to unlock their own fees.
- A holder who also owns `$DAODEGEN` is the most aligned actor: burning tokens is the price of accessing fee income.
- If no one calls `release()`, fees simply accumulate in the Jar's balance until someone does.

This is intentional. The burn cost acts as a rate-limiter on how frequently fees are distributed, preventing gas-wasteful micro-releases. The `burnAmount` is adjustable by the contract owner.

### Fee distribution is pull-based

Fees are never pushed to holders. After `release()` writes to `claimable`, each holder must call `claim()` to withdraw. This avoids DoS from reverting recipients and keeps gas costs predictable.

### `afterSwap` is not directly callable

The hook's `afterSwap` is gated by `onlyPoolManager`. It fires automatically whenever a swap is routed through the pool using the DaoDeGenHook. The fee (1% of swap output) is taken via `manager.take()` and forwarded to the Jar.

### Soulbound agents

AgentRegistry tokens are soulbound (non-transferable). Once registered, an agent's identity is permanent until revoked by the contract owner. This prevents identity markets.

## Flow Diagram

```
Swap -> PoolManager -> Hook.afterSwap() -> takes 1% fee -> sends to Jar
                                                              |
                                                              v
Anyone (burns $DAODEGEN) -> Jar.release() -> distributes to claimable[tokenId]
                                                              |
                                                              v
NFT holder -> Jar.claim(tokenId) -> receives ETH/ERC20
```
