# Go-Live Runbook -- Dao DeGen Production Deployment

> Tracks GitHub issue #137. Step-by-step operational runbook for launching the production frontend.

**Last updated:** 2026-02-23
**Topology:** Mac mini (dev) -> GitHub CI -> GHCR (image registry) -> Production VPS (docker compose)
**Image:** `ghcr.io/0xpotatoofdoom/daodegen`
**Production port:** 3000
**Network:** Unichain mainnet (chain ID 130)

---

## 1. Pre-Launch Checklist

### 1a. Smart Contracts

- [ ] All contracts deployed to Unichain mainnet (chain ID 130)
- [ ] All contracts verified on Uniscan mainnet
- [ ] Ownership transferred to Gnosis Safe (issue #110)
  - [ ] DaoDeGenJar -- `transferOwnership()`
  - [ ] VerseNFT -- `transferOwnership()`
  - [ ] AgentRegistry -- `transferOwnership()`
  - [ ] DaoDeGenHook -- redeployed with Safe as `msg.sender`
- [ ] Pause/unpause tested on mainnet for each pausable contract
- [ ] `setBaseURI("https://daodegen.com/api/verse/")` called on VerseNFT (see `docs/DEPENDENCY_MAP.md`)
- [ ] IPFS migration complete -- verse illustrations uploaded, `verses.json` updated with IPFS CIDs
- [ ] Contract addresses recorded for `production.env`

### 1b. Environment Variables

- [ ] `production.env` created on VPS from `production.env.example`
- [ ] All values populated (no placeholder zeros or empty strings)
- [ ] `JWT_SECRET` is cryptographically random (`openssl rand -hex 32`)
- [ ] `NEXT_PUBLIC_UNICHAIN_RPC` is a private Alchemy/QuickNode endpoint
- [ ] WalletConnect project ID configured for production domain
- [ ] SIWE allowlists set: `SIWE_ALLOWED_DOMAINS=daodegen.com`, `SIWE_ALLOWED_CHAIN_IDS=130`
- [ ] `PONDER_API_URL` set to Ponder indexer endpoint (e.g. `http://localhost:42069`). Ponder must be running and indexing mainnet contracts.

### 1c. Infrastructure

- [ ] Production VPS accessible via SSH
- [ ] Docker + docker compose installed
- [ ] VPS authenticated to GHCR (`docker login ghcr.io`)
- [ ] DNS A record for `daodegen.com` points to VPS
- [ ] TLS configured (Caddy/nginx with Let's Encrypt)
- [ ] Firewall: 443 open, 3000 blocked from public

### 1d. CI / Image

- [ ] Latest `main` CI is green (all jobs pass)
- [ ] Image `ghcr.io/0xpotatoofdoom/daodegen:latest` exists in GHCR
- [ ] Record the exact commit SHA for the image tag

### 1e. Staging Validation

- [ ] Same image running on staging for at least 24 hours
- [ ] All smoke tests pass on staging
- [ ] No open P0/P1 issues

### 1f. Incident Readiness

- [ ] `docs/INCIDENT_RESPONSE.md` reviewed
- [ ] Emergency pause commands ready
- [ ] Escalation contacts confirmed

---

## 2. Deploy Contracts to Mainnet

All commands run from `packages/contracts/`.

### Prerequisites

Ensure the following are set in `packages/contracts/.env`:

```
MAINNET_PRIVATE_KEY=0x...
INITIAL_HOLDER=0x...          # receives the full token supply
ETHERSCAN_API_KEY=...         # Uniscan API key for verification
```

### Step 1: Deploy core contracts (Token, NFT, Jar, Hook, AgentRegistry)

```bash
cd packages/contracts
make deploy-mainnet
```

This runs `forge script script/Deploy.s.sol:Deploy` against `https://mainnet.unichain.org` (chain ID 130). The script will:

1. Deploy DaoDeGenToken (initial holder receives 81M tokens)
2. Deploy VerseNFT (mintPrice = 0.01 ETH on mainnet)
3. Deploy DaoDeGenJar (burnAmount = 10,000 DAODEGEN on mainnet)
4. Mine a Hook address with the AFTER_SWAP_FLAG permission prefix (can take up to 100k nonce attempts -- be patient)
5. Deploy DaoDeGenHook at the mined address
6. Deploy AgentRegistry

The script prints a deployment summary. **Record all 5 addresses:**

```
=== DEPLOYMENT SUMMARY ===
Chain ID: 130
DaoDeGenToken:  <TOKEN>
VerseNFT:       <NFT>
DaoDeGenJar:    <JAR>
DaoDeGenHook:   <HOOK>
AgentRegistry:  <REGISTRY>
```

### Step 2: Deploy PrayerBurn

PrayerBurn reads token and jar addresses from env vars on mainnet. Set them from the deployment summary above:

```bash
export DAODEGEN_TOKEN=<TOKEN address from step 1>
export DAODEGEN_JAR=<JAR address from step 1>
make deploy-prayerburn-mainnet
```

Record the PrayerBurn address from the output:

```
=== PRAYERBURN DEPLOYMENT ===
Chain ID: 130
PrayerBurn: <PRAYER_BURN>
```

### Step 3: Manual verification (if auto-verify failed)

The `deploy-mainnet` and `deploy-prayerburn-mainnet` targets pass `--verify` to forge. If auto-verification fails for any contract, run the verify commands manually. Note: the Makefile verify targets currently hardcode `--chain-id 1301` (Sepolia). For mainnet, override the chain ID:

```bash
# Token
forge verify-contract \
  --chain-id 130 \
  --constructor-args $(cast abi-encode "constructor(address)" $INITIAL_HOLDER) \
  <TOKEN> src/DaoDeGenToken.sol:DaoDeGenToken \
  --etherscan-api-key $ETHERSCAN_API_KEY

# NFT (mintPrice = 0.01 ether = 10000000000000000)
forge verify-contract \
  --chain-id 130 \
  --constructor-args $(cast abi-encode "constructor(string,uint256)" "https://daodegen.com/api/verse/" 10000000000000000) \
  <NFT> src/VerseNFT.sol:VerseNFT \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Jar (burnAmount = 10000e18 = 10000000000000000000000)
forge verify-contract \
  --chain-id 130 \
  --constructor-args $(cast abi-encode "constructor(address,address,uint256)" <TOKEN> <NFT> 10000000000000000000000) \
  <JAR> src/DaoDeGenJar.sol:DaoDeGenJar \
  --etherscan-api-key $ETHERSCAN_API_KEY

# PrayerBurn (minimumBurn = 100e18, cooldown = 60)
forge verify-contract \
  --chain-id 130 \
  --constructor-args $(cast abi-encode "constructor(address,address,uint256,uint256)" <TOKEN> <JAR> 100000000000000000000 60) \
  <PRAYER_BURN> src/PrayerBurn.sol:PrayerBurn \
  --etherscan-api-key $ETHERSCAN_API_KEY

# AgentRegistry (no constructor args)
forge verify-contract \
  --chain-id 130 \
  <REGISTRY> src/AgentRegistry.sol:AgentRegistry \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### Step 4: Confirm on Uniscan

Visit `https://unichain.blockscout.com/address/<ADDRESS>` for each contract and confirm the "Contract" tab shows verified source.

---

## 3. Gnosis Safe + Ownership Transfer

### Step 1: Create Safe

1. Go to [app.safe.global](https://app.safe.global)
2. Select Unichain mainnet (chain ID 130)
3. Create a new Safe with the desired signers and threshold
4. Record the Safe address: `<SAFE>`

### Step 2: Transfer ownership

Three contracts have `transferOwnership()` -- DaoDeGenJar, VerseNFT, AgentRegistry:

```bash
export RPC="https://mainnet.unichain.org"
export SAFE="<safe-address>"

# Jar
cast send <JAR> "transferOwnership(address)" $SAFE \
  --private-key $MAINNET_PRIVATE_KEY --rpc-url $RPC

# VerseNFT
cast send <NFT> "transferOwnership(address)" $SAFE \
  --private-key $MAINNET_PRIVATE_KEY --rpc-url $RPC

# AgentRegistry
cast send <REGISTRY> "transferOwnership(address)" $SAFE \
  --private-key $MAINNET_PRIVATE_KEY --rpc-url $RPC
```

### Step 3: Verify ownership transferred

```bash
cast call <JAR> "owner()" --rpc-url $RPC
cast call <NFT> "owner()" --rpc-url $RPC
cast call <REGISTRY> "owner()" --rpc-url $RPC
# All three should return $SAFE
```

### DaoDeGenHook -- known limitation

The Hook's owner is `msg.sender` at deploy time (set immutably in the Ownable constructor). There is no `transferOwnership()` on the Hook. If Safe ownership of the Hook is required, the Hook must be **redeployed** with the Safe as the deployer (or via a deploy script that `vm.prank`s the Safe). For launch, the deployer EOA retains Hook ownership. Document this as a follow-up if governance over Hook parameters is needed.

---

## 4. Code Changes (Inline Patches)

Each subsection shows the exact file, current code, and required change. Apply all patches before building the release image.

### 4a. Facilitator -- mainnet chain

**File:** `packages/facilitator/src/index.ts`

**Lines 24-25** -- RPC env var and default:

```diff
-const RPC_URL =
-  process.env.UNICHAIN_SEPOLIA_RPC || "https://sepolia.unichain.org";
+const RPC_URL =
+  process.env.UNICHAIN_RPC || "https://mainnet.unichain.org";
```

**Lines 31-38** -- Chain definition:

```diff
-const unichainSepolia = defineChain({
-  id: 1301,
-  name: "Unichain Sepolia",
-  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
-  rpcUrls: {
-    default: { http: [RPC_URL] },
-  },
-  testnet: true,
-});
+const unichain = defineChain({
+  id: 130,
+  name: "Unichain",
+  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
+  rpcUrls: {
+    default: { http: [RPC_URL] },
+  },
+  testnet: false,
+});
```

Update all references from `unichainSepolia` to `unichain` (lines 48, 53).

**Line 76** -- Network registration:

```diff
-  networks: "eip155:1301",
+  networks: "eip155:130",
```

**Line 239** -- Health check response:

```diff
-      json(req, res, 200, { status: "ok", network: "eip155:1301" });
+      json(req, res, 200, { status: "ok", network: "eip155:130" });
```

### 4b. x402 -- mainnet chain

**File:** `packages/frontend/src/lib/x402.ts`

**Lines 5-6** -- CAIP-2 identifier and USDC address:

```diff
-const UNICHAIN_SEPOLIA_CAIP2 = "eip155:1301";
-const UNICHAIN_USDC = "0x31d0220469e10c4E71834a79b1f276d740d3768F";
+const UNICHAIN_CAIP2 = "eip155:130";
+const UNICHAIN_USDC = "<UNICHAIN_MAINNET_USDC>";  // Look up canonical USDC on Unichain mainnet
```

> **Action required:** Look up the canonical USDC contract address on Unichain mainnet from Circle's documentation or the Unichain bridge UI before applying this patch.

**Line 18** -- Comment:

```diff
-// Register a money parser that knows about USDC on Unichain Sepolia.
+// Register a money parser that knows about USDC on Unichain mainnet.
```

**Lines 22, 35, 43** -- Update all references from `UNICHAIN_SEPOLIA_CAIP2` to `UNICHAIN_CAIP2`:

```diff
-  if (network === UNICHAIN_SEPOLIA_CAIP2) {
+  if (network === UNICHAIN_CAIP2) {
```

```diff
-  .register(UNICHAIN_SEPOLIA_CAIP2, evmScheme);
+  .register(UNICHAIN_CAIP2, evmScheme);
```

```diff
-export const USDC_NETWORK = UNICHAIN_SEPOLIA_CAIP2;
+export const USDC_NETWORK = UNICHAIN_CAIP2;
```

### 4c. Contract address defaults

**File:** `packages/frontend/src/lib/contracts.ts`

**Line 1** -- Comment:

```diff
-// Contract addresses — Unichain Sepolia (chain 1301)
+// Contract addresses — Unichain mainnet (chain 130)
```

**Lines 3-7** -- Update fallback addresses to mainnet addresses from the deployment output in section 2:

```diff
-  VERSE_NFT: process.env.NEXT_PUBLIC_VERSE_NFT_ADDRESS || '0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50',
-  DAODEGEN_TOKEN: process.env.NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS || '0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16',
-  DAODEGEN_JAR: process.env.NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS || '0xd25a5C67F180811e43990B2A0148Ac0d93ab9336',
-  AGENT_REGISTRY: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || '0xBFE569F809b644703175Be603684Be0b7f6eee89',
-  PRAYER_BURN: process.env.NEXT_PUBLIC_PRAYER_BURN_ADDRESS || '0x38C7AD96C2f5c90BE692605a7a7B633071122c72',
+  VERSE_NFT: process.env.NEXT_PUBLIC_VERSE_NFT_ADDRESS || '<MAINNET_NFT>',
+  DAODEGEN_TOKEN: process.env.NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS || '<MAINNET_TOKEN>',
+  DAODEGEN_JAR: process.env.NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS || '<MAINNET_JAR>',
+  AGENT_REGISTRY: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || '<MAINNET_REGISTRY>',
+  PRAYER_BURN: process.env.NEXT_PUBLIC_PRAYER_BURN_ADDRESS || '<MAINNET_PRAYER_BURN>',
```

Replace each `<MAINNET_*>` placeholder with the actual address from section 2 deployment output.

### 4d. Agent page UI text

**File:** `packages/frontend/src/app/agent/page.tsx`

**Line 225** -- Payment info display:

```diff
-                            Network: eip155:1301 (Unichain Sepolia)<br/>
+                            Network: eip155:130 (Unichain)<br/>
```

**Line 219** -- Description text:

```diff
-                            The {selectedTier} endpoint requires USDC payment on Unichain Sepolia via x402.
+                            The {selectedTier} endpoint requires USDC payment on Unichain via x402.
```

### 4e. MCP server auth chain

**File:** `packages/mcp-server/src/auth.ts`

**Line 8** -- Import:

```diff
-import { unichainSepolia } from "viem/chains";
+import { unichain } from "viem/chains";
```

**Line 35** -- Wallet client chain:

```diff
-    chain: unichainSepolia,
+    chain: unichain,
```

### 4f. SIWE chain allowlist

**File:** `packages/frontend/src/lib/auth.ts`

**Line 23** -- Default allowed chain IDs:

```diff
-  (process.env.SIWE_ALLOWED_CHAIN_IDS || '1301,130').split(',').map(id => Number(id.trim()))
+  (process.env.SIWE_ALLOWED_CHAIN_IDS || '130').split(',').map(id => Number(id.trim()))
```

The code already supports env var override. For production, set `SIWE_ALLOWED_CHAIN_IDS=130` in `production.env`.

### 4g. WalletConnect project ID

**File:** `packages/frontend/src/lib/wagmi.ts`

No code change needed. Line 34 already reads `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` from env with a `'demo-project-id'` fallback. Ensure `production.env` sets this to a real project ID registered at [cloud.walletconnect.com](https://cloud.walletconnect.com) for the `daodegen.com` domain.

### 4h. Deploy.s.sol baseURI

**File:** `packages/contracts/script/Deploy.s.sol`

**Line 104** -- Mainnet baseURI (the mainnet config block, chain ID 130):

```diff
-                baseURI: "https://daodegen.xyz/api/metadata/",
+                baseURI: "https://daodegen.com/api/verse/",
```

This aligns with the `setBaseURI` value in the pre-launch checklist (section 1a) so newly minted NFTs get the correct tokenURI from deployment.

Also update line 95 (Sepolia config) if you want consistency, though it only affects future Sepolia deploys:

```diff
-                baseURI: "https://daodegen.xyz/api/metadata/",
+                baseURI: "https://daodegen.com/api/verse/",
```

---

## 5. Service Migration

### 5a. Facilitator

After applying code changes from section 4a:

1. **Build and deploy** the facilitator service
2. **Fund the facilitator wallet** on Unichain mainnet with ETH for gas (the facilitator settles x402 payments on-chain)
3. **Set env vars:**

```
FACILITATOR_PRIVATE_KEY=0x...        # funded wallet
UNICHAIN_RPC=https://mainnet.unichain.org   # or private RPC
FRONTEND_ORIGIN=https://daodegen.com
NODE_ENV=production
```

4. **Verify:**

```bash
curl http://localhost:4402/health
# Expected: {"status":"ok","network":"eip155:130"}
```

### 5b. Ponder Indexer

Set the following env vars for the Ponder service:

```
PONDER_CHAIN=mainnet
PONDER_JAR_ADDRESS=<mainnet jar address>
PONDER_NFT_ADDRESS=<mainnet nft address>
PONDER_TOKEN_ADDRESS=<mainnet token address>
PONDER_REGISTRY_ADDRESS=<mainnet registry address>
PONDER_PRAYER_BURN_ADDRESS=<mainnet prayer burn address>
PONDER_START_BLOCK=<block number of first core contract deployment tx>
PONDER_PRAYER_BURN_START_BLOCK=<block number of PrayerBurn deployment tx>
PONDER_RPC_URL_130=<mainnet rpc url>
```

Then restart Ponder. It will pick up `PONDER_CHAIN=mainnet`, set chain ID to 130, and use the chain name `unichain` internally (see `packages/ponder/ponder.config.ts`).

**Verify:**

```bash
curl http://localhost:42069/status
# Should show indexing progress starting from the deployment block
```

### 5c. Address Propagation Matrix

Each mainnet contract address must be set in **3 places**. Use this table to confirm nothing was missed:

| Contract | Frontend `production.env` | Ponder env | Other |
|---|---|---|---|
| DaoDeGenToken | `NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS` | `PONDER_TOKEN_ADDRESS` | Hardcoded fallback in `contracts.ts` (patch 4c) |
| VerseNFT | `NEXT_PUBLIC_VERSE_NFT_ADDRESS` | `PONDER_NFT_ADDRESS` | Hardcoded fallback in `contracts.ts` (patch 4c) |
| DaoDeGenJar | `NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS` | `PONDER_JAR_ADDRESS` | Hardcoded fallback in `contracts.ts` (patch 4c) |
| AgentRegistry | `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS` | `PONDER_REGISTRY_ADDRESS` | Hardcoded fallback in `contracts.ts` (patch 4c) |
| PrayerBurn | `NEXT_PUBLIC_PRAYER_BURN_ADDRESS` | `PONDER_PRAYER_BURN_ADDRESS` | Hardcoded fallback in `contracts.ts` (patch 4c) |
| USDC (x402) | -- | -- | Hardcoded in `x402.ts` (patch 4b) |

---

## 6. Post-Deploy Contract Setup

Run these after contracts are deployed (section 2) and ownership is transferred (section 3).

### 6a. Set base URI on VerseNFT

```bash
# If ownership already transferred to Safe, execute via Safe UI.
# If still owned by deployer EOA:
cast send <NFT> "setBaseURI(string)" "https://daodegen.com/api/verse/" \
  --private-key $MAINNET_PRIVATE_KEY --rpc-url $RPC
```

Verify:

```bash
cast call <NFT> "tokenURI(uint256)" 1 --rpc-url $RPC
# Should return: https://daodegen.com/api/verse/1
```

### 6b. IPFS migration

Upload verse illustrations to IPFS and update the verse metadata:

```bash
cd packages/frontend
npm run ipfs:migrate
```

Requires `PINATA_API_KEY` and `PINATA_SECRET_API_KEY` in env.

### 6c. Pause/unpause governance drill

Test that the Safe can pause and unpause each pausable contract. Execute these as Safe transactions:

```bash
# Pause (from Safe)
cast calldata "pause()"
# -> 0x8456cb59
# Submit this calldata to each pausable contract via Safe UI

# Verify paused
cast call <JAR> "paused()(bool)" --rpc-url $RPC   # true
cast call <NFT> "paused()(bool)" --rpc-url $RPC   # true

# Unpause (from Safe)
cast calldata "unpause()"
# -> 0x3f4ba83a
# Submit to each contract via Safe UI

# Verify unpaused
cast call <JAR> "paused()(bool)" --rpc-url $RPC   # false
cast call <NFT> "paused()(bool)" --rpc-url $RPC   # false
```

This confirms the Safe has working governance over emergency controls before going public.

---

## 7. End-to-End QA

Critical test paths that must pass before public launch. Run after all code changes (section 4), service migrations (section 5), and contract setup (section 6) are complete.

### 7a. Wallet connect

- [ ] Connect MetaMask to the site on Unichain mainnet
- [ ] Verify chain ID 130 in the wallet
- [ ] Verify the WalletConnect modal opens and lists Unichain

### 7b. Verse metadata

```bash
curl -s https://daodegen.com/api/verse/1/metadata | jq .
# Should return valid NFT metadata with mainnet image URLs (IPFS CIDs)
```

### 7c. Congregation state

```bash
curl -s https://daodegen.com/v1/congregation/state | jq .
# Should return valid JSON with "ponderConnected": true
```

### 7d. Discovery

```bash
curl -s https://daodegen.com/.well-known/soul.json | jq .
# Should return mainnet endpoints (chain ID 130, correct contract addresses)
```

### 7e. SIWE auth

Full authentication cycle:

1. `GET /api/auth/nonce` -- receive nonce
2. Construct SIWE message with chain ID 130
3. Sign with wallet
4. `POST /api/auth/verify` -- receive JWT
5. Verify JWT grants access to authenticated endpoints

### 7f. NFT mint

- [ ] Mint a VerseNFT via the `/verses` page (costs 0.01 ETH on mainnet)
- [ ] Verify ownership: `cast call <NFT> "ownerOf(uint256)" <tokenId> --rpc-url $RPC`
- [ ] Verify tokenURI resolves to valid metadata

### 7g. Token swap

- [ ] Swap ETH for DAODEGEN on Uniswap (Unichain mainnet)
- [ ] Verify the DaoDeGenHook fires (check for AfterSwap event)
- [ ] Verify fees land in the Jar: `cast call <JAR> "outstanding(address)" <NATIVE_CURRENCY> --rpc-url $RPC`

### 7h. Fee release via prayer

```bash
# Call pray() on PrayerBurn (requires holding >= 100 DAODEGEN)
cast send <PRAYER_BURN> "pray(uint256)" <amount> \
  --private-key $MAINNET_PRIVATE_KEY --rpc-url $RPC

# Verify Jar.release() fired (check FeesReleased event in tx receipt)
# Verify NFT holders can claim
cast call <JAR> "claimable(uint256,address)" 1 <NATIVE_CURRENCY> --rpc-url $RPC
```

### 7i. Sermon generation

```bash
curl -X POST https://daodegen.com/v1/sermon \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"prayer_tx": "<prayer-tx-hash>"}'
# Should return AI-generated sermon
```

### 7j. x402 verse oracle

```bash
curl -X POST https://daodegen.com/v1/verse/lookup \
  -H "Content-Type: application/json" \
  -d '{"verse": 1}'
# Should return 402 Payment Required
# An x402-compatible client should handle: 402 -> pay USDC -> 200 with verse data
```

### 7k. Health check

```bash
curl -s https://daodegen.com/api/health | jq .
# All checks should show ok
```

---

## 8. Deploy Procedure

All commands on the **production VPS**.

### Step 1: Pull the release image

```bash
export RELEASE_SHA="<commit-sha>"
export IMAGE="ghcr.io/0xpotatoofdoom/daodegen:${RELEASE_SHA}"
docker pull "$IMAGE"
```

### Step 2: Verify production.env

```bash
# Should produce NO output -- any output means a placeholder was left in
cat production.env | grep -E '(0x0000|your_|YOUR_|^JWT_SECRET=$|^ANTHROPIC_API_KEY=$)'
```

### Step 3: Bring up the stack

```bash
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs -f frontend
# Wait for: "ready - started server on 0.0.0.0:3000"
```

### Step 4: Verify health

```bash
# Container status (should show "healthy" after ~45s)
docker compose -f docker-compose.production.yml ps

# Local health check
curl -f http://localhost:3000/

# Public health check (from any machine)
curl -f https://daodegen.com/
```

### Step 5: Record the deployment

```bash
echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') -- Deployed ${RELEASE_SHA}" >> /var/log/daodegen-deploys.log
```

---

## 9. Smoke Test Checklist

Run immediately after deploy, before announcing launch.

### 9a. Page Loads

```bash
BASE="https://daodegen.com"
for path in "/" "/verses" "/swap" "/claim" "/agent" "/verse/1" "/api/verse/1/metadata" "/.well-known/agent-registration.json" "/v1/congregation/state"; do
  echo "$path $(curl -sf -o /dev/null -w '%{http_code}' ${BASE}${path})"
done
# All should return 200
```

### 9b. Contract Reads

```bash
export RPC="<production-rpc>"

# Token supply (should be 81_000_000 * 10^18)
cast call <TOKEN_ADDRESS> "totalSupply()(uint256)" --rpc-url $RPC

# NFT supply
cast call <NFT_ADDRESS> "totalSupply()(uint256)" --rpc-url $RPC

# Jar not paused
cast call <JAR_ADDRESS> "paused()(bool)" --rpc-url $RPC
```

### 9c. Browser Manual Tests

- [ ] Homepage loads, no console errors
- [ ] Stat cards show real data (token supply, NFT count, jar balance)
- [ ] WalletConnect modal opens
- [ ] Wallet connects on Unichain mainnet (chain ID 130)
- [ ] `/verses` displays verses
- [ ] `/claim` shows claimable balances
- [ ] Contract addresses section expandable on homepage

### 9d. Security Spot Checks

```bash
# No sensitive headers
curl -sI https://daodegen.com/ | grep -iE '(x-powered-by|server:)'

# HTTPS redirect
curl -sI http://daodegen.com/ | head -3

# Rate limiting active
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" https://daodegen.com/api/health; done
```

---

## 10. Rollback Procedure

### Option A: Revert to previous image

```bash
export ROLLBACK_SHA="<previous-sha>"
docker pull "ghcr.io/0xpotatoofdoom/daodegen:${ROLLBACK_SHA}"
# Update docker-compose.production.yml image tag
docker compose -f docker-compose.production.yml up -d
curl -f http://localhost:3000/
```

### Option B: Full stop

```bash
docker compose -f docker-compose.production.yml down
# Serve maintenance page via reverse proxy
```

### After any rollback

1. Log it: `echo "$(date -u) -- ROLLBACK to ${ROLLBACK_SHA}" >> /var/log/daodegen-deploys.log`
2. Create a GitHub issue documenting what failed
3. If contracts affected, see `docs/INCIDENT_RESPONSE.md`

---

## 11. Post-Launch Monitoring

### First Hour (check every 10 min)

- [ ] Container healthy: `docker compose -f docker-compose.production.yml ps`
- [ ] Logs clean: `docker compose -f docker-compose.production.yml logs --since 10m frontend`
- [ ] Site responsive: `curl -f -w "time_total: %{time_total}s\n" https://daodegen.com/`
- [ ] Memory/CPU stable: `docker stats --no-stream`

```bash
# Health loop (run in tmux)
while true; do
  echo "$(date -u '+%H:%M:%S') $(curl -sf -o /dev/null -w '%{http_code} %{time_total}s' https://daodegen.com/)"
  sleep 60
done
```

### First Day

- [ ] Container restart count is 0: `docker inspect --format='{{.RestartCount}}' $(docker compose -f docker-compose.production.yml ps -q frontend)`
- [ ] No errors in logs: `docker compose -f docker-compose.production.yml logs frontend 2>&1 | grep -iE '(error|fatal|ECONNREFUSED)'`
- [ ] Log rotation working: `du -sh /var/lib/docker/containers/*/`
- [ ] RPC within Alchemy plan limits
- [ ] Disk space adequate: `df -h`

### Symptom / Action Table

| Symptom | Likely Cause | Action |
|---|---|---|
| Container restarts | Bad env var, crash in startup | Check logs, verify `production.env` |
| 502/503 from proxy | Container not running | `docker compose ps`, restart |
| Contract reads return zeros | Wrong addresses in env | Verify with `cast call` |
| Wallet connect fails | Wrong WalletConnect project ID | Check WC dashboard |
| Slow page loads (>3s) | RPC rate limiting | Check Alchemy dashboard |
| 429 from API routes | Rate limiter working | Only investigate if legit users affected |

### Cron Health Check (until Sentry -- issue #116)

```bash
# /etc/cron.d/daodegen-healthcheck
*/5 * * * * root curl -sf http://localhost:3000/ > /dev/null || echo "DAODEGEN DOWN at $(date)" >> /var/log/daodegen-alerts.log
```

---

## Quick Reference

```bash
# Start
docker compose -f docker-compose.production.yml up -d

# Stop
docker compose -f docker-compose.production.yml down

# Logs
docker compose -f docker-compose.production.yml logs -f frontend

# Update
docker pull ghcr.io/0xpotatoofdoom/daodegen:<new-sha>
docker compose -f docker-compose.production.yml up -d

# Stats
docker stats --no-stream
```

## Related Docs

| Document | Path |
|---|---|
| Staging runtime | `docs/STAGING_RUNTIME.md` |
| Incident response | `docs/INCIDENT_RESPONSE.md` |
| Dependency map | `docs/DEPENDENCY_MAP.md` |
| Production env template | `production.env.example` |
| CI pipeline | `.github/workflows/ci.yml` |
