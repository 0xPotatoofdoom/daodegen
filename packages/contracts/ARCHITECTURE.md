# Dao DeGen Contract Architecture

## Flow

```
User swaps $DAODEGEN ←→ ETH/USDC on Uniswap V4
        ↓
  DaoDeGenHook.afterSwap()
  Takes 1% fee from swap output
        ↓
  Fee tokens sent to DaoDeGenJar
  (accumulates over time)
        ↓
  Anyone calls jar.release()
  Burns $DAODEGEN tokens
        ↓
  Jar distributes ALL accumulated fees
  proportionally to VerseNFT holders (1/81 each)
```

## Contracts

### DaoDeGenToken.sol (ERC-20)
- 81M supply (1M per verse)
- Burnable (for release mechanism)
- Simple — no special logic needed

### VerseNFT.sol (ERC-721)
- Max 81 tokens (IDs 1-81)
- Each represents one verse of the Dao DeGen
- Holding = revenue share from swap fees
- Owner can mint (initial distribution) or public mint

### DaoDeGenHook.sol (V4 Hook)
- `afterSwap` + `afterSwapReturnDelta`
- Takes 1% (100 bps) of swap output
- Sends fee to DaoDeGenJar
- Reference: `unichain-demo/src/SwapPoints.sol` for afterSwap pattern

### DaoDeGenJar.sol (Fee Distribution)
- Receives fees from hook
- Pull-based pattern: `release()` burns $DAODEGEN and writes to `claimable` mapping, holders call `claim()` to withdraw
- Uses SafeERC20 for token transfers
- Based on Uniswap protocol-fees TokenJar + ExchangeReleaser pattern

### AgentRegistry.sol (EIP-8004 Identity)
- Soulbound ERC-721 -- one identity NFT per agent address, non-transferable
- `register(metadataURI)` mints an agent identity NFT
- `update(newMetadataURI)` updates agent metadata
- `isAgent(address)` / `getAgentId(address)` for on-chain identity checks
- Used by the Agent API for SIWE authentication gating

### WrappedVerseNFT.sol (BACKLOG — NOT DEPLOYED)
- `ERC721Wrapper + ERC721Votes` wrapping VerseNFT for future on-chain governance
- Stub contract exists in repo but is not deployed and not part of v1
- See Phase 4 in `docs/ROADMAP.md` (backlogged)

### DaoDeGenGovernor.sol (BACKLOG — NOT DEPLOYED)
- OZ Governor v5 stub for future on-chain governance
- Stub contract exists in repo but is not deployed and not part of v1
- See Phase 4 in `docs/ROADMAP.md` (backlogged)

## Governance

V1 ships with admin-controlled configuration (deployer EOA or Gnosis Safe multisig). On-chain governance via `DaoDeGenGovernor` is backlogged until there is a real congregation. The stub contracts exist in the repo for future use but are not deployed.

## Key Differences from UNIfication
- We burn $DAODEGEN and release to 81 NFT holders (proportional split) rather than to a treasury
- No bridging, no vesting, no multi-chain

## Gas Notes
- Pull-based distribution is implemented: `release()` writes to `claimable`, holders `claim()` individually
- `release()` enforces `assets.length <= MAX_ASSETS` (10) to bound both the O(n²) duplicate-asset
  check and the worst-case SSTORE count (81 holders × 10 assets = 810 cold SSTOREs, ~16-18 M gas)
- Full-capacity release (81 holders, 2 assets) gas is benchmarked in `GasBenchmark.t.sol`; callers
  should budget at least 20 M gas for worst-case invocations
- Future: consider Merkle distributor or epoch batching if gas costs become prohibitive
