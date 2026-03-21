# Chain Configuration

## Where it lives

Chain configuration is centralized in `packages/frontend/src/lib/chain-config.ts`.
It exports a `chainConfig` object used throughout the frontend.

Contract addresses live in `packages/frontend/src/lib/contracts.ts` and re-export `chainConfig`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ACTIVE_CHAIN` | `sepolia` | Chain preset: `sepolia` or `mainnet` |
| `NEXT_PUBLIC_CHAIN_ID` | (from preset) | Override chain ID |
| `NEXT_PUBLIC_RPC_URL` | (from preset) | Override RPC URL |
| `NEXT_PUBLIC_EXPLORER_URL` | (from preset) | Override block explorer URL |

## Presets

- **sepolia**: Unichain Sepolia (chain ID 1301) — default for dev
- **mainnet**: Unichain (chain ID 130)

## How to change chains

Set `NEXT_PUBLIC_ACTIVE_CHAIN=mainnet` in `.env` and rebuild.
All `NEXT_PUBLIC_*` vars are inlined at build time by Next.js.

## Future work

A future refactor (GH#356) will centralize chain config across all packages
(frontend, contracts, MCP server, facilitator) into a shared package.
Currently each package resolves chain settings independently.
