# Dao DeGen Contracts

Foundry project for Dao DeGen on-chain distribution.

## Contracts

| Contract | Description |
|----------|-------------|
| `DaoDeGenToken.sol` | ERC-20 token ($DAODEGEN), burnable |
| `VerseNFT.sol` | ERC-721, 81 max supply (one per verse) |
| `DaoDeGenHook.sol` | V4 afterSwap hook -- routes 1% of swap output to jar |
| `DaoDeGenJar.sol` | Fee accumulator -- NFT holders burn $DAODEGEN to release, then claim. Uses SafeERC20 |
| `AgentRegistry.sol` | EIP-8004 soulbound agent identity registry |

## Setup

```bash
forge install
forge build
```

## Testing

```bash
# Full test suite (10k fuzz runs, 1000-run invariant tests)
forge test -vv

# Fork tests against Unichain Sepolia (requires RPC)
UNICHAIN_SEPOLIA_RPC=https://... forge test --match-contract ForkTest -vv

# Gas snapshot baseline
forge snapshot

# Check snapshot hasn't regressed
forge snapshot --check
```

### Test categories

- **Unit tests** (`DaoDeGenJar.t.sol`, `DaoDeGenHook.t.sol`, etc.) -- core functionality
- **Fuzz tests** (`FuzzTest.t.sol`) -- 10k runs per property
- **Invariant tests** (`InvariantTest.t.sol`) -- 1000 runs, 50 calls/run, verifying `outstanding == sum(claimable)` and balance solvency
- **Fork tests** (`ForkTest.t.sol`) -- against real Unichain Sepolia PoolManager, skipped when no RPC
- **Gas benchmarks** (`GasBenchmark.t.sol`) -- full-capacity release costs

## Static Analysis

```bash
# Requires: pip3 install slither-analyzer
slither . --config-file slither.config.json
```

Config filters `lib/`, `test/`, `script/` paths. See `slither.config.json`.

## Deploy

Target chain: Unichain
