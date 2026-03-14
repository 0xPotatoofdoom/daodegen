# DaoDeGen Contract Deployment Guide

## Quick Start

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your keys and configuration
   ```

2. **Local testing**:
   ```bash
   make anvil          # Start local node (in separate terminal)
   make deploy-local   # Deploy to local network
   ```

3. **Testnet deployment**:
   ```bash
   make deploy-sepolia
   ```

4. **Mainnet deployment**:
   ```bash
   make deploy-mainnet  # Includes confirmation prompt
   ```

## Deployment Order

The contracts are deployed in this specific order:

1. **DaoDeGenToken** - ERC-20 token with 81M max supply
2. **VerseNFT** - ERC-721 with 81 verses, mint price configurable
3. **DaoDeGenJar** - Fee accumulator, requires token + NFT addresses
4. **DaoDeGenHook** - V4 hook, requires jar address + hook address mining
5. **AgentRegistry** - EIP-8004 soulbound agent identity registry (standalone, no dependencies on other contracts)

## Hook Address Mining

V4 hooks require specific address prefixes based on their permissions. The deployment script automatically mines an address that matches the `AFTER_SWAP_FLAG` permission.

This process can take some time and uses CREATE2 with incrementing salts until the correct prefix is found.

## Configuration

Key parameters in `.env`:

- `INITIAL_HOLDER`: Address receiving initial 81M tokens
- `BASE_URI`: Base URI for NFT metadata (e.g., `https://daodegen.xyz/api/metadata/`)
- `MINT_PRICE`: NFT mint price in wei (e.g., `1000000000000000` = 0.001 ETH)
- `BURN_AMOUNT`: DAODEGEN tokens required to trigger fee release (e.g., `1000000000000000000000` = 1000 tokens)
- `POOL_MANAGER`: Uniswap V4 PoolManager address for the target network

## Verification

Contracts are automatically verified on Etherscan during deployment. If auto-verification fails, use manual commands:

```bash
make verify-token TOKEN_ADDRESS=0x...
make verify-nft NFT_ADDRESS=0x...
make verify-jar JAR_ADDRESS=0x...
```

## Network Configurations

### Unichain Sepolia Testnet
- Chain ID: 1301
- PoolManager: `0x00B036B58a818B1BC34d502D3fE730Db729e62AC`
- RPC: `https://sepolia.unichain.org` (rate-limited; use Alchemy for deploys)
- Block Explorer: `https://sepolia.uniscan.xyz`
- Mint Price: 0.001 ETH
- Burn Amount: 1000 DAODEGEN

### Unichain Mainnet
- Chain ID: 130
- PoolManager: `0x1F98400000000000000000000000000000000004`
- RPC: `https://mainnet.unichain.org` (rate-limited; use Alchemy for deploys)
- Block Explorer: `https://uniscan.xyz`
- Mint Price: 0.01 ETH
- Burn Amount: 10,000 DAODEGEN

## Development Commands

```bash
make build          # Compile contracts
make test           # Run tests
make gas-report     # Generate gas usage report
make docs           # Generate documentation
make clean          # Clean build artifacts
```

## Deployed Contracts (Unichain Sepolia)

| Contract | Address |
|----------|---------|
| DaoDeGenToken | `0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16` |
| VerseNFT | `0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50` |
| DaoDeGenJar | `0xd25a5C67F180811e43990B2A0148Ac0d93ab9336` |
| DaoDeGenHook | `0x00Cf948a66547e26f0374c215a2E55c0ed527F73` |
| AgentRegistry | `0xBFE569F809b644703175Be603684Be0b7f6eee89` |

| PrayerBurn | `0x22A0EDaBF0a567C8eE646472607c25c9021920D6` |
| SermonCommitment | `0xF38a1c25079762977F42fD8C5B23C32B4Bc2551D` |
| AnonymousPrayer | `0x31C01646f56fEF263ebcbaceb605f6cF5FFec991` |

All contracts verified on [Unichain Sepolia Explorer](https://sepolia.uniscan.xyz).

> **Note (2026-03-14):** PrayerBurn, SermonCommitment, and AnonymousPrayer were redeployed
> with the facilitator key (`0x3D0e10329c864A7422761af058f909267a776029`) as owner/pastor/recorder.
> PrayerBurn.setSermonCommitment() has been called to link the escrow contract.

## Post-Deployment

After successful deployment:

1. Update `.env` with deployed contract addresses
2. Test basic functionality:
   ```bash
   make mint-nft
   make check-balances
   ```
3. Verify all contracts on block explorer
4. Update frontend configuration with new addresses
5. Add contracts to monitoring/alerting systems

## Security Notes

- Private keys in `.env` are never committed to git
- Mainnet deployment includes confirmation prompt
- All contracts are immutable after deployment (no upgrade mechanisms)
- Hook address mining is deterministic but computationally intensive
- Test thoroughly on Sepolia before mainnet deployment

## Troubleshooting

**Hook mining takes too long**: Increase the nonce limit in `Deploy.s.sol` or use a different salt prefix.

**Verification fails**: Check Etherscan API key and constructor arguments. Use manual verification commands.

**Out of gas**: Increase gas limit in deployment script or split deployment into multiple transactions.

**Address mismatch**: Ensure CREATE2 salt calculation matches between mining and deployment phases.