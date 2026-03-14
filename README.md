# Dao DeGen

**81 Verses of DeFi Wisdom** — The Tao Te Ching, reimagined for the decentralized age.

*x · y = k doesn't care about your feelings.*

## Architecture

- `packages/frontend/` -- Next.js 16 + TypeScript + Tailwind (daodegen.com / internetmoneyisserious.business)
- `packages/contracts/` -- Foundry project: V4 Hook, ERC-20, ERC-721 (81 NFTs), TokenJar, AgentRegistry
- `packages/facilitator/` -- Self-hosted x402 facilitator for Unichain mainnet (chainId 130) payment settlement
- `scripts/` -- Tooling (IPFS upload, secret scanning)
- `docs/` -- Architecture decisions, deployment guides, incentive model

## Stack

- **Chain:** Unichain
- **DEX:** Uniswap V4 (custom hook)
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, RainbowKit/wagmi
- **Contracts:** Solidity, Foundry, OpenZeppelin
- **Distribution:** 81 NFTs (one per verse), swap fee revenue sharing via TokenJar pattern

## Deployed Contracts

### Unichain Mainnet (chainId 130) — LIVE ✅

Deployed 2026-03-13 by Leo EOA (`0x0026C0b91f3132A4C02910Bc0a9b0c504040c108`).

| Contract | Address |
|----------|---------|
| DaoDeGenToken | [`0x2719dcB7...`](https://uniscan.xyz/address/0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947) |
| VerseNFT | [`0xA5290EEf...`](https://uniscan.xyz/address/0xA5290EEfEEd1dCBE8e8f12D9584Bc7bd14f948A1) |
| DaoDeGenJar | [`0x78D404fA...`](https://uniscan.xyz/address/0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b) |
| DaoDeGenHook | [`0x000FCDfd...`](https://uniscan.xyz/address/0x000FCDfd31d4a78b261A5256A1fD1EDbbc009937) |
| AgentRegistry | [`0x81058210...`](https://uniscan.xyz/address/0x8105821036A5AD70B1291787C2Eabf455038eE20) |

### Unichain Sepolia (chainId 1301) — Testnet

| Contract | Address |
|----------|---------|
| DaoDeGenToken | [`0x9BbF24f...`](https://sepolia.uniscan.xyz/address/0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16) |
| VerseNFT | [`0x63d24FA...`](https://sepolia.uniscan.xyz/address/0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50) |
| DaoDeGenJar | [`0xd25a5C6...`](https://sepolia.uniscan.xyz/address/0xd25a5C67F180811e43990B2A0148Ac0d93ab9336) |
| DaoDeGenHook | [`0x00Cf948...`](https://sepolia.uniscan.xyz/address/0x00Cf948a66547e26f0374c215a2E55c0ed527F73) |
| AgentRegistry | [`0xBFE569F...`](https://sepolia.uniscan.xyz/address/0xBFE569F809b644703175Be603684Be0b7f6eee89) |

## Agent API (EIP-8004 + x402)

The platform includes an "Agent API" designed for autonomous AI agents.
- **Authentication:** EIP-8004 style identity registry + SIWE (Sign-In with Ethereum).
- **Payments:** x402 (L402) Lightning Network payment protocol for premium data access.

Visit `/agent` on the frontend to register an identity and test the payment flow.

See [docs/AGENT_API_GUIDE.md](docs/AGENT_API_GUIDE.md) for full documentation.

## Development

```bash
# Install
npm install
cd packages/contracts && forge install

# Contract tests (10k fuzz runs, invariant tests)
cd packages/contracts && forge test -vv

# Fork tests (requires UNICHAIN_SEPOLIA_RPC env var)
cd packages/contracts && forge test --match-contract ForkTest -vv

# Gas snapshot
cd packages/contracts && forge snapshot

# Slither static analysis
cd packages/contracts && slither . --config-file slither.config.json

# Frontend
npm run test -w packages/frontend
npm run lint

# Secret scanning
bash scripts/scan-secrets.sh
```

See [docs/INCENTIVE_MODEL.md](docs/INCENTIVE_MODEL.md) for how the fee distribution and token burn mechanics work.

## Team

| Role | Who |
|------|-----|
| CEO/Strategy | Matt |
| CTO/PM | Leo 🦕 |
| Frontend | IMISB |
| Backend/Contracts | RockLobster 🦞 |
| Media/Socials | SurfaceClaw 🏄 |
| QA | ThaiPi 🍓 |

## Links

- [daodegen.com](https://daodegen.com)
- [xykdoesntcare.com](https://xykdoesntcare.com)
- [internetmoneyisserious.business](https://internetmoneyisserious.business)
- Twitter: [@srsmoneybizness](https://twitter.com/srsmoneybizness)

## License

Dual-licensed:

- **Code** (contracts, frontend, API, indexer, scripts): [MIT](LICENSE-MIT)
- **Content** (soul.md, verses.json, illustrations, ebook): [CC0 1.0](LICENSE-CC0)

The words belong to no one. The code belongs to everyone.

## The Synthesis Hackathon (2026)

daodegen is competing in [The Synthesis](https://synthesis.md/) — a 14-day AI agent hackathon judged on-chain.

**Tracks entered:** Build with x402 · Agents that pay · Best Uniswap API Integration · Synthesis Open Track

**Leo** (CTO/PM agent, OpenClaw + Claude Sonnet) deployed all contracts autonomously using a self-custody EOA wallet.
