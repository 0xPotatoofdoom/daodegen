# Staging Runtime (Port 3033)

This document captures the agreed staging deployment plan for Dao DeGen on the OpenClaw tailnet VPS.

## Overview

| Item | Value |
| ---- | ----- |
| Runtime | Docker + docker compose |
| Service | `frontend` (packages/frontend) |
| Port | `3033` (tailnet-only exposure) |
| Image | Built locally from repo `Dockerfile` |
| Entry command | `npm run frontend:start` (Next.js `next start`) |
| Health check | HTTP `GET /` inside container via `curl` |
| Logs | Docker json-file (`docker compose logs -f frontend`) |

The container uses staging-only environment variables (`staging.env`) so no production secrets are required or baked into the image.

If the Ponder indexer is running on the same VPS, set `PONDER_API_URL=http://localhost:42069` in `staging.env` to enable on-chain congregation stats. If unset, the frontend falls back to in-memory data only.

## Files Added

- `Dockerfile`: multi-stage build for the Next.js frontend.
- `.dockerignore`: trims build context (no `node_modules`, git data, etc.).
- `docker-compose.staging.yml`: single-service compose stack targeting port 3033.
- `staging.env.example`: safe template that can be copied to `staging.env` on the server.

## Deploy / Operate

```bash
# on openclaw VPS inside repo root
cp staging.env.example staging.env   # edit values for staging RPC, wallet connect, etc.
docker compose -f docker-compose.staging.yml up -d --build
```

- **Start**: `docker compose -f docker-compose.staging.yml up -d`
- **Stop**: `docker compose -f docker-compose.staging.yml down`
- **Rebuild** (after code changes): add `--build`
- **Logs**: `docker compose -f docker-compose.staging.yml logs -f frontend`
- **Health**: `docker compose -f docker-compose.staging.yml ps` or `curl -f http://localhost:3033/`

### Rollbacks / Updates

1. Pull new code / checkout commit.
2. Rebuild image: `docker compose -f docker-compose.staging.yml up -d --build`
3. Verify health: `curl -f http://localhost:3033/` from the VPS or `http://openclaw.tailnet:3033/` from another tailnet node.
4. If something breaks, `git checkout` the previous commit and rebuild.

### Log Retention

Docker's json-file driver is limited to 5 files × 10MB each (50MB total). Older logs are rotated automatically. For long-term retention forward logs to Loki/Elastic if needed.

## Access Control

- Compose only publishes `3033/tcp`. Tailscale ACLs restrict access to the VPS, so there is no public exposure.
- No production secrets. Use dedicated staging RPC endpoints. Contract addresses are configured in `packages/frontend/src/lib/contracts.ts` (Unichain Sepolia).

## Verification Checklist

1. `docker compose -f docker-compose.staging.yml up -d --build`
2. `curl -f http://localhost:3033/` returns HTML.
3. `docker compose -f docker-compose.staging.yml logs -f frontend` shows `ready - started server on 0.0.0.0:3033`.
4. Open tailnet URL `http://openclaw.tail16a58c.ts.net:3033` from an authorized machine.

Document owner: Dr. Claw 🦾
