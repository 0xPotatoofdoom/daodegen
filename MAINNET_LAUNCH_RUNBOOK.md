# DaoDeGen Mainnet Launch Runbook

> Last updated: 2026-03-19
> Status: **NOT YET LAUNCHED** — frontend on Sepolia v4 pending mainnet readiness

---

## Mainnet Contract Addresses (chainId 130)

| Contract | Address | Deployer |
|---|---|---|
| DaoDeGenToken | `0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947` | `0x0026C0b9...` |
| VerseNFT | `0xA5290EEfEEd1dCBE8e8f12D9584Bc7bd14f948A1` | `0x0026C0b9...` |
| DaoDeGenJar | `0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b` | `0x0026C0b9...` |
| DaoDeGenHook | `0x000FCDfd31d4a78b261A5256A1fD1EDbbc009937` | `0x0026C0b9...` |
| AgentRegistry | `0x8105821036A5AD70B1291787C2Eabf455038eE20` | `0x0026C0b9...` |
| PrayerBurn | `0x2aFB7e968D034BBbe0c53E27C4359192D72544ae` | `0x0026C0b9...` |

Deployer wallet (mainnet): `0x0026C0b91f3132A4C02910Bc0a9b0c504040c108`
RPC: `https://mainnet.unichain.org`

---

## Pre-Launch Checklist

### Step 1 — PrayerBurn setup (requires deployer wallet `0x0026C0b9...`)

The mainnet PrayerBurn is deployed but **not configured**. Must be done from `0x0026C0b9...`:

```bash
RPC="https://mainnet.unichain.org"
PRAYER_BURN="0x2aFB7e968D034BBbe0c53E27C4359192D72544ae"
TOKEN="0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947"
JAR="0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b"

# 1a. Approve Jar to spend DAODEGEN from PrayerBurn
cast send $PRAYER_BURN "approveJar()" \
  --rpc-url $RPC --private-key $DEPLOYER_KEY

# 1b. Set release threshold (suggest 0.001 ETH for mainnet)
cast send $PRAYER_BURN "setReleaseThreshold(uint256)" 1000000000000000 \
  --rpc-url $RPC --private-key $DEPLOYER_KEY

# 1c. Fund PrayerBurn with DAODEGEN (from whoever holds the supply)
# Suggest 100,000 DAODEGEN to start
cast send $TOKEN "transfer(address,uint256)" $PRAYER_BURN 100000000000000000000000 \
  --rpc-url $RPC --private-key $HOLDER_KEY
```

Verify:
```bash
cast call $PRAYER_BURN "releaseThreshold()(uint256)" --rpc-url $RPC  # should be 1000000000000000
cast call $TOKEN "balanceOf(address)(uint256)" $PRAYER_BURN --rpc-url $RPC  # should be >0
cast call $TOKEN "allowance(address,address)(uint256)" $PRAYER_BURN $JAR --rpc-url $RPC  # should be max
```

### Step 2 — Flip frontend to mainnet

Edit `packages/frontend/.env.local`:

```bash
NEXT_PUBLIC_ACTIVE_CHAIN=mainnet
NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS=0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947
NEXT_PUBLIC_VERSE_NFT_ADDRESS=0xA5290EEfEEd1dCBE8e8f12D9584Bc7bd14f948A1
NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS=0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x8105821036A5AD70B1291787C2Eabf455038eE20
NEXT_PUBLIC_PRAYER_BURN_ADDRESS=0x2aFB7e968D034BBbe0c53E27C4359192D72544ae
NEXT_PUBLIC_SERMON_COMMITMENT_ADDRESS=<deploy-if-needed>
NEXT_PUBLIC_ANONYMOUS_PRAYER_ADDRESS=<deploy-if-needed>
```

> **Note:** SermonCommitment and AnonymousPrayer are not in the mainnet deployment yet.
> Deploy them if needed before launch, or omit if those flows aren't in scope for v1.

Then rebuild and restart:
```bash
cd ~/daodegen/packages/frontend
npm run build
pm2 restart daodegen
```

### Step 3 — Flip 0xdead.church to mainnet

Edit `~/0xDeadChurch/.env.local`:
```bash
NEXT_PUBLIC_ACTIVE_CHAIN=mainnet
NEXT_PUBLIC_PRAYER_BURN_ADDRESS=0x2aFB7e968D034BBbe0c53E27C4359192D72544ae
NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS=0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947
```

Then:
```bash
cd ~/0xDeadChurch
npm run build
pm2 restart 0xdead-church
```

### Step 4 — Update Ponder indexer to mainnet

Edit `packages/ponder/.env`:
```bash
PONDER_NETWORK=mainnet
PONDER_JAR_ADDRESS=0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b
PONDER_NFT_ADDRESS=0xA5290EEfEEd1dCBE8e8f12D9584Bc7bd14f948A1
PONDER_REGISTRY_ADDRESS=0x8105821036A5AD70B1291787C2Eabf455038eE20
PONDER_PRAYER_BURN_ADDRESS=0x2aFB7e968D034BBbe0c53E27C4359192D72544ae
PONDER_PRAYER_BURN_START_BLOCK=<mainnet-deploy-block>
PONDER_START_BLOCK=<mainnet-deploy-block>
```

Then restart:
```bash
pm2 delete ponder-indexer
cd ~/daodegen/packages/ponder
pm2 start "npx ponder start --schema v3" --name ponder-indexer
pm2 save
```

### Step 5 — Smoke test (before announcing)

Run through all 6 flows end-to-end:
- [ ] Connect wallet (mainnet Unichain)
- [ ] Swap ETH → DAODEGEN via frontend
- [ ] Mint VerseNFT
- [ ] Pray (anonymous + signed) → sermon response received
- [ ] Claim ETH from Jar as NFT holder
- [ ] Agent API: `GET /api/soul.json`, `POST /api/sermon`, `GET /api/congregation`

---

## Current Status (2026-03-19)

- ✅ All 20 audit findings resolved (10 off-chain, 10 contract-level via Leo's PRs)
- ✅ Sepolia v4 fully E2E verified (7/7 contract tests + full cascade)
- ✅ Frontend currently on **Sepolia** (safe)
- ⏳ PrayerBurn mainnet not yet configured (threshold=0, no DAODEGEN, no approveJar)
- ⏳ SermonCommitment + AnonymousPrayer not deployed to mainnet yet
- ⏳ Demo video (#219) not recorded

## Rollback Plan

If mainnet launch has issues, revert to Sepolia:
```bash
# Restore .env.local to Sepolia v4 addresses (see unichain-sepolia-v4.json)
# npm run build && pm2 restart daodegen
# Everything Sepolia is verified and stable
```
