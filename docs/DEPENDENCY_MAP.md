# DaoDeGen Dependency Map

This document catalogues every external protocol dependency, deployed contract address, and RPC endpoint used by the DaoDeGen project. Single source of truth for address verification and integration reference.

Last updated: 2026-02-23

---

## DaoDeGen Contracts (Unichain Sepolia -- chain ID 1301)

| Contract | Address | Source |
|---|---|---|
| DaoDeGenToken (ERC-20) | `0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16` | `packages/frontend/src/lib/contracts.ts` |
| VerseNFT (ERC-721) | `0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50` | `packages/frontend/src/lib/contracts.ts` |
| DaoDeGenJar (Fee Distribution) | `0xd25a5C67F180811e43990B2A0148Ac0d93ab9336` | `packages/frontend/src/lib/contracts.ts` |
| AgentRegistry (EIP-8004) | `0xBFE569F809b644703175Be603684Be0b7f6eee89` | `packages/frontend/src/lib/contracts.ts` |
| DaoDeGenHook (V4 Hook) | *(mined at deploy time -- address depends on CREATE2 salt)* | `packages/contracts/script/Deploy.s.sol` |
| PrayerBurn | `0x38C7AD96C2f5c90BE692605a7a7B633071122c72` | `packages/contracts/src/PrayerBurn.sol` |

All addresses are overridable at runtime via `NEXT_PUBLIC_*` environment variables.

### NFT Metadata

The VerseNFT contract has an owner-only `setBaseURI()` function. Once the production domain is confirmed, call:

```bash
cast send <VERSE_NFT_ADDRESS> "setBaseURI(string)" "https://daodegen.com/api/verse/" --rpc-url $RPC --private-key $OWNER_KEY
```

This makes `tokenURI(1)` resolve to `https://daodegen.com/api/verse/1/metadata`, which returns ERC-721 standard JSON (name, description, image, external_url, attributes).

---

## External Protocol Dependencies

### Uniswap V4 PoolManager

| Network | Chain ID | Address | Usage |
|---|---|---|---|
| Unichain Sepolia | 1301 | `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` | DaoDeGenHook registers with this PoolManager to intercept `afterSwap` |
| Unichain Mainnet | 130 | `0x1F98400000000000000000000000000000000004` | Production PoolManager (not yet deployed against) |

**Verification:** https://docs.uniswap.org/contracts/v4/deployments

### USDC on Unichain Sepolia

| Token | Chain | Address | Decimals |
|---|---|---|---|
| USDC | Unichain Sepolia (1301) | `0x31d0220469e10c4E71834a79b1f276d740d3768F` | 6 |

Used by the x402 payment protocol to gate verse oracle API access.

**Verification:** https://developers.circle.com/stablecoins/usdc-on-test-networks

### x402 Payment Facilitator

| Dependency | Default URL |
|---|---|
| Facilitator service | `http://localhost:4402` (overridable via `FACILITATOR_URL` env var) |

Handles payment verification for paywall-gated verse oracle endpoints.

### Pastor API Endpoints (Phase 2)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/v1/sermon` | POST | JWT (SIWE) | Submit prayer payload, receive sermon. Per-wallet 60s cooldown. |
| `/v1/congregation/state` | GET | None | Rolling 24h sentiment index. Public. |
| `/.well-known/soul.json` | GET | None | Machine-readable agent discovery for the temple. |

The sermon endpoint uses `AnthropicLLMProvider.generateSermon()` with the system prompt built from `soul.md` + verse index + congregation state.

Congregation state merges two data sources (#170):
- **In-memory:** 24h rolling-window sentiment tracker (`getSummary()` for the pastor prompt)
- **On-chain (Ponder):** prayer counts, burned amounts, fee releases, NFT holder counts (`getOnChainState()`)

The `/v1/congregation/state` route merges both and returns `ponderConnected: true/false`. If Ponder is unreachable or `PONDER_API_URL` is unset, the endpoint returns in-memory data only (backwards compatible).

---

## Solidity Library Dependencies

Vendored under `packages/contracts/lib/` via Foundry:

| Library | Purpose |
|---|---|
| `v4-core` (Uniswap) | `IPoolManager`, `IHooks`, `PoolKey`, `Currency` types |
| `openzeppelin-contracts` | ERC-20, ERC-721 base contracts, `SafeERC20`, `Pausable`, `Ownable` |
| `solmate` | `SafeTransferLib` |

---

### Ponder Indexer API

| Endpoint | Method | Description |
|---|---|---|
| `${PONDER_API_URL}/prayers/stats` | GET | Prayer count and total burned DAODEGEN |
| `${PONDER_API_URL}/fees/recent?limit=N` | GET | Recent fee release events |
| `${PONDER_API_URL}/nfts/holders` | GET | Current NFT holder addresses |

**Configuration:** `PONDER_API_URL` environment variable. Server-side only, not publicly exposed. Default: `http://localhost:42069` on the VPS.

REST client: `packages/frontend/src/lib/ponder.ts`. Wired to frontend congregation module via `getOnChainState()` in `packages/frontend/src/lib/congregation.ts` (PR #170).

---

## RPC Endpoints

| Network | Chain ID | Default RPC | Env Override |
|---|---|---|---|
| Unichain Mainnet | 130 | `https://mainnet.unichain.org` | `NEXT_PUBLIC_UNICHAIN_RPC` |
| Unichain Sepolia | 1301 | *(must be provided)* | `UNICHAIN_SEPOLIA_RPC` |
| Ponder Indexer | -- | `http://localhost:42069` | `PONDER_API_URL` |

---

## Chain IDs Reference

| Network | Chain ID | Usage |
|---|---|---|
| Unichain Sepolia | 1301 | Current testnet deployment |
| Unichain Mainnet | 130 | Production target |
| Ethereum Mainnet | 1 | Wallet connectivity only (wagmi) |
| Base | 8453 | Wallet connectivity only (wagmi) |
| Arbitrum | 42161 | Wallet connectivity only (wagmi) |
| Polygon | 137 | Wallet connectivity only (wagmi) |

---

## How to Verify Addresses

```bash
# Confirm bytecode exists
cast code <address> --rpc-url $UNICHAIN_SEPOLIA_RPC

# Fork test (PoolManager)
UNICHAIN_SEPOLIA_RPC=<url> forge test --match-test testPoolManagerExists -vvv

# Verify USDC
cast call 0x31d0220469e10c4E71834a79b1f276d740d3768F "symbol()(string)" --rpc-url $UNICHAIN_SEPOLIA_RPC
cast call 0x31d0220469e10c4E71834a79b1f276d740d3768F "decimals()(uint8)" --rpc-url $UNICHAIN_SEPOLIA_RPC
```
