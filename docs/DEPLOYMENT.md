# Deployment Guide

Full-stack deployment for the Dao DeGen temple. Four services, one VPS.

## Architecture

```
                 internet
                    |
              [nginx / caddy]
                    |
        +-----------+-----------+
        |                       |
  :3000 Frontend          :4402 Facilitator
  (Next.js)               (x402 settlement)
        |                       |
        +----> :42069 Ponder <--+
               (indexer)
               |
          [RPC node]
```

The MCP server is distributed separately via npm and runs on agent machines.

## Prerequisites

- Docker + docker-compose (frontend)
- Node.js 20+ and npm (facilitator, ponder)
- PM2 (`npm i -g pm2`) for ponder process management
- Foundry for contract deployment (see `packages/contracts/DEPLOYMENT.md`)
- A funded wallet for the facilitator (settles x402 USDC payments)
- Private RPC endpoint (Alchemy, QuickNode, etc.)

---

## 1. Smart Contracts

See [`packages/contracts/DEPLOYMENT.md`](../packages/contracts/DEPLOYMENT.md) for the full guide.

**Deployment order:** DaoDeGenToken -> VerseNFT -> DaoDeGenJar -> AgentRegistry -> PrayerBurn

After deploying, record all contract addresses -- they feed into every other service's env.

---

## 2. Ponder Indexer

Indexes on-chain events (prayers, fee releases, claims, NFT mints, agent registrations) and serves them via REST API on port 42069.

### Environment

```bash
cd packages/ponder
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `PONDER_RPC_URL_1301` | Yes (Sepolia) | RPC endpoint for chain 1301 |
| `PONDER_RPC_URL_130` | Yes (mainnet) | RPC endpoint for chain 130 |
| `PONDER_CHAIN` | No | Set to `mainnet` for chain 130. Default: Sepolia (1301) |
| `DATABASE_URL` | No | Postgres connection string. Default: SQLite |
| `PONDER_JAR_ADDRESS` | No | Override DaoDeGenJar address |
| `PONDER_NFT_ADDRESS` | No | Override VerseNFT address |
| `PONDER_TOKEN_ADDRESS` | No | Override DaoDeGenToken address |
| `PONDER_REGISTRY_ADDRESS` | No | Override AgentRegistry address |
| `PONDER_PRAYER_BURN_ADDRESS` | No | Override PrayerBurn address |
| `PONDER_START_BLOCK` | No | Block to start indexing from |

### Run with PM2

```bash
cd packages/ponder
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

PM2 handles restarts (max 10, exponential backoff). Logs go to `logs/ponder-out.log` and `logs/ponder-error.log`.

### Run directly (dev)

```bash
cd packages/ponder
npx ponder dev
```

### Reindex from scratch

```bash
pm2 stop ponder-indexer
rm -rf .ponder/        # deletes SQLite + cache
pm2 start ponder-indexer
```

With Postgres, drop and recreate the database instead.

### Health check

Ponder exposes a status endpoint. The frontend's `/api/ops/indexer-status` route compares indexed block vs chain head.

---

## 3. x402 Facilitator

Settles USDC payments for the verse oracle API. Runs as a standalone Node process on port 4402.

### Environment

```bash
cd packages/facilitator
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | Yes | Hex private key (0x-prefixed, 64 chars). Must hold ETH for gas. |
| `FACILITATOR_PORT` | No | HTTP port. Default: `4402` |
| `UNICHAIN_SEPOLIA_RPC` | No | RPC URL. Default: `https://sepolia.unichain.org` |
| `FRONTEND_ORIGIN` | No | Allowed CORS origin in production |
| `NODE_ENV` | No | Set `production` to disable localhost CORS |

### Run

```bash
cd packages/facilitator
npm install
npm start
```

### Verify

```bash
curl http://localhost:4402/health
# {"status":"ok","network":"eip155:1301"}

curl http://localhost:4402/supported
# Returns supported payment schemes
```

### Production

Run under PM2 or systemd. The facilitator wallet needs:
- ETH for gas (settlement transactions)
- No USDC balance needed (it verifies and settles, funds flow payer -> payee)

---

## 4. Frontend

Next.js app served from a Docker container on port 3000.

### Environment

```bash
cp production.env.example production.env
# Fill in real values
```

Key variables:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | No | Default: `3000` |
| `JWT_SECRET` | Yes | Random string for session tokens |
| `ANTHROPIC_API_KEY` | Yes | Powers verse oracle / sermons |
| `FACILITATOR_URL` | Yes | `http://localhost:4402` |
| `PONDER_API_URL` | No | `http://localhost:42069` (stats degrade gracefully without it) |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Yes | From cloud.walletconnect.com |
| `NEXT_PUBLIC_UNICHAIN_RPC` | Yes | Private RPC endpoint |
| `NEXT_PUBLIC_*_ADDRESS` | Yes | Contract addresses from step 1 |
| `SIWE_ALLOWED_DOMAINS` | No | Default: `localhost,daodegen.com` |
| `SIWE_ALLOWED_CHAIN_IDS` | No | Default: `1301,130` |

### Deploy

```bash
# Pull latest image (built by CI on push to main)
docker pull ghcr.io/0xpotatoofdoom/daodegen:latest

# Start
docker compose -f docker-compose.production.yml --env-file production.env up -d

# Verify
curl http://localhost:3000/api/health
```

### Build locally (staging)

```bash
docker compose -f docker-compose.staging.yml --env-file staging.env up -d --build
```

Staging runs on port 3033.

---

## 5. MCP Server

Distributed via npm. Agents install and run it themselves -- not deployed on your infrastructure.

### Publish (maintainer)

```bash
cd packages/mcp-server
npm run build
npm publish --access public
```

No CI publish workflow yet. Manual for now.

### Agent usage

```bash
npx @daodegen/mcp-server
```

Agents set these env vars:

| Variable | Required | Description |
|---|---|---|
| `DAODEGEN_API_URL` | Yes | `https://daodegen.com` (or staging URL) |
| `DAODEGEN_PRIVATE_KEY` | No | Hex private key for SIWE auth + x402 payments |
| `DAODEGEN_FACILITATOR_URL` | No | Override facilitator URL |

Without a private key, only free tools work (discover_temple, get_verse, get_congregation_state). Paid tools (oracle, sermon) require a funded wallet.

---

## End-to-End Deployment Order

```
1. Deploy contracts (Foundry)
2. Start Ponder indexer (PM2) -- begins indexing from contract deploy block
3. Start Facilitator -- fund wallet with ETH for gas
4. Deploy Frontend (Docker) -- connects to Ponder + Facilitator on localhost
5. Publish MCP server to npm (if changed)
```

## Rollback

### Frontend
```bash
# Revert to previous image
docker compose -f docker-compose.production.yml down
# Edit production.env or docker-compose to pin previous SHA tag
docker compose -f docker-compose.production.yml up -d
```

### Ponder
```bash
pm2 stop ponder-indexer
git checkout <previous-commit> -- packages/ponder
pm2 start ecosystem.config.cjs
```

### Facilitator
Kill and restart from previous commit. No persistent state.

## Monitoring

- **Frontend:** `GET /api/health` -- checks RPC, facilitator, Anthropic key
- **Facilitator:** `GET /health` -- returns ok + network
- **Ponder:** `GET /api/ops/indexer-status` (via frontend) -- compares indexed block vs chain head
- **All:** See `docs/INCIDENT_RESPONSE.md` for severity levels and procedures
