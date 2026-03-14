# @daodegen/ponder

Blockchain indexer for the Dao DeGen temple. Indexes on-chain events (prayers, fee releases, claims, NFT mints, agent registrations) and serves them via REST API.

## What it does

Uses the [Ponder](https://ponder.sh) framework to watch five contracts on Unichain and build queryable tables:

- **prayers** -- PrayerBurn events (sender, amount, type, tx hash)
- **feeReleases** -- DaoDeGenJar fee distribution events
- **claims** -- NFT holder fee claims
- **nftMints / nftTransfers** -- VerseNFT activity
- **agents** -- AgentRegistry registrations

The frontend reads from Ponder at `http://localhost:42069` for stats, activity feeds, and the ops dashboard.

## Environment

| Variable | Required | Default |
|---|---|---|
| `PONDER_RPC_URL_1301` | Yes (Sepolia) | `https://sepolia.unichain.org` |
| `PONDER_RPC_URL_130` | Yes (mainnet) | `https://mainnet.unichain.org` |
| `PONDER_CHAIN` | No | Sepolia. Set `mainnet` for chain 130 |
| `DATABASE_URL` | No | SQLite (file-based) |
| `PONDER_*_ADDRESS` | No | Override any contract address |
| `PONDER_START_BLOCK` | No | Default per network |

## Run

```bash
npx ponder dev              # development (hot reload)
npx ponder start --schema v1  # production
```

## Run with PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

Logs: `logs/ponder-out.log`, `logs/ponder-error.log`. Auto-restart with exponential backoff.

## Reindex

```bash
pm2 stop ponder-indexer
rm -rf .ponder/
pm2 start ponder-indexer
```

With Postgres, drop and recreate the database.

## Test

```bash
npm test
```
