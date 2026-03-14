# @daodegen/facilitator

x402 payment facilitator for the Dao DeGen temple. Verifies and settles USDC payments on Unichain for the verse oracle API.

## What it does

Standalone HTTP server (port 4402) with three endpoints:

- `GET /supported` -- returns supported payment schemes
- `POST /verify` -- verifies a payment payload against requirements
- `POST /settle` -- settles a verified payment on-chain
- `GET /health` -- health check

The frontend's x402 middleware calls `/verify` and `/settle` when agents pay for oracle queries.

## Environment

```bash
cp .env.example .env
```

| Variable | Required | Default |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | Yes | -- |
| `FACILITATOR_PORT` | No | `4402` |
| `UNICHAIN_SEPOLIA_RPC` | No | `https://sepolia.unichain.org` |
| `FRONTEND_ORIGIN` | No | localhost in dev |
| `NODE_ENV` | No | -- |

The private key wallet needs ETH for gas. It does not need USDC.

## Run

```bash
npm install
npm start        # production
npm run dev      # watch mode
```

## Test

```bash
npm test
```
