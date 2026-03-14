# Self Protocol Integration — Anonymous Prayer Mode

> "Your burn history is visible on-chain, but your prayer *content* and *intent* can be private."

## Why Prayer Privacy Matters

Every DAODEGEN burn is a public on-chain transaction. Anyone can see that wallet `0xABC...` burned 100 DAODEGEN. But the *prayer* attached to that burn — the spiritual question, the confession, the doubt — that deserves privacy.

Without privacy, a user's entire spiritual journey is linkable:
- Their wallet history reveals their trading behavior
- Their prayer content reveals their emotional state
- The combination links financial anxiety to specific positions

Self Protocol breaks this link. You can prove you burned tokens (eligibility) without revealing *which wallet* burned them.

## How Self Protocol Works

Self is an identity wallet that uses **zk-SNARKs** to generate privacy-preserving proofs from government-issued IDs (passports, ID cards, Aadhaar).

For daodegen's anonymous prayer mode:

1. **User scans their ID** with the Self mobile app (NFC chip on passport)
2. **Self generates a ZK proof** proving the user is a real human
3. **Proof is submitted** to `/v1/sermon/anonymous` instead of a wallet address
4. **Backend verifies** the proof via `SelfBackendVerifier`
5. **Sermon is generated** with no wallet address logged — only a nullifier (one-time token)

The nullifier prevents proof replay without linking to identity.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Self Mobile │────▶│ QR Code /    │────▶│ ZK Proof        │
│  App         │     │ Universal    │     │ (zk-SNARK)      │
│              │     │ Link         │     │                 │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Sermon      │◀───│ Backend      │◀───│ POST /v1/sermon/ │
│  Response    │     │ Verifier     │     │ anonymous        │
│  (anonymous) │     │ (Celo Hub)   │     │ {proof, message} │
└─────────────┘     └──────────────┘     └─────────────────┘
```

### Component Breakdown

| Component | Location | Purpose |
|-----------|----------|---------|
| `self-protocol.ts` | `packages/frontend/src/lib/` | Backend verifier + QR config builder |
| `PrivatePrayerToggle.tsx` | `packages/frontend/src/components/` | UI toggle + Self QR code display |
| `anonymous/route.ts` | `packages/frontend/src/app/v1/sermon/` | Anonymous sermon endpoint |
| `AnonymousPrayer.sol` | `packages/contracts/src/` | On-chain nullifier registry |

### Verification Flow

**Standard Prayer** (existing):
```
Wallet → SIWE auth → JWT → POST /v1/sermon → {sender: "0xABC...", message: "..."}
```

**Anonymous Prayer** (new):
```
Self App → ZK proof → POST /v1/sermon/anonymous → {proof: {...}, message: "..."}
                                                    ↓
                                              sender: "anonymous"
                                              nullifier recorded
                                              no wallet logged
```

## "Agents That Keep Secrets" Pillar

This integration maps directly to the Synthesis hackathon **"Agents That Keep Secrets"** pillar:

1. **The agent (Dao DeGen pastor) processes prayers without knowing who sent them.** The ZK proof proves eligibility; the nullifier prevents abuse. The pastor never sees the wallet.

2. **Privacy is not optional — it's architectural.** When `mode: private` is selected, there is no code path that logs the wallet address. The sender field is literally `"anonymous"`.

3. **Self Protocol is the named partner** for this pillar. The integration uses their official SDK (`@selfxyz/core`) for both proof generation (frontend QR) and verification (backend `SelfBackendVerifier`).

4. **Cross-chain ZK verification.** Self's Hub V2 is deployed on Celo, but the backend verifier works from any chain by connecting to Celo's RPC. The `AnonymousPrayer.sol` contract is ready for direct on-chain verification when Hub V2 deploys to Unichain (or via Hyperlane cross-chain messaging).

## API Reference

### POST /v1/sermon/anonymous

Submit an anonymous prayer with a Self Protocol ZK proof.

**No JWT required** — the ZK proof is the authentication.

```json
{
  "proof": {
    "attestationId": 1,
    "proof": {
      "a": ["0x...", "0x..."],
      "b": [["0x...", "0x..."], ["0x...", "0x..."]],
      "c": ["0x...", "0x..."]
    },
    "publicSignals": ["..."],
    "userContextData": ""
  },
  "message": "Should I hold through this drawdown?",
  "prayer_type": "question",
  "burn_amount": "100"
}
```

**Response:**
```json
{
  "sermon": {
    "content": "Verse 44 teaches...",
    "verse_references": [44],
    "sentiment_tag": "seeking",
    "response_type": "full"
  },
  "anonymous": true,
  "privacy": "Self Protocol ZK proof verified — no wallet identity recorded"
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| 400  | Missing or malformed proof payload |
| 403  | ZK proof verification failed |
| 409  | Nullifier already used (proof replay attempt) |
| 429  | Cooldown — wait before next anonymous prayer |

## Smart Contract: AnonymousPrayer.sol

The on-chain component records anonymous prayers with nullifier tracking:

```solidity
// Records an anonymous prayer after off-chain ZK verification
function recordAnonymousPrayer(bytes32 nullifier, bytes32 messageHash) external;

// Check if a nullifier has been used (prevents proof replay)
function isNullifierUsed(bytes32 nullifier) external view returns (bool);
```

**Current status:** Backend verification (off-chain via Celo Hub V2).

**Future:** When Self Protocol's `IdentityVerificationHub V2` deploys on Unichain (or via Hyperlane cross-chain), the contract can inherit `SelfVerificationRoot` for full on-chain ZK verification.

## SDK Packages

```bash
npm install @selfxyz/core    # Backend verification + universal links
```

Note: `@selfxyz/qrcode` requires React 18. We use `qrcode.react` (already in the project) to render QR codes and `getUniversalLink` from `@selfxyz/core` to generate the Self deeplinks.

## Agent Registration (Self Protocol Agent ID)

The Dao DeGen pastor is registered as a verified agent on Self Protocol:

| Field | Value |
|-------|-------|
| **Agent ID** | `25` |
| **Agent Address** | `0x7d7AC1aAaBCEeb12149615A05C17FE74b8730c46` |
| **Human (linked)** | `0x3D0e10329c864A7422761af058f909267a776029` |
| **Chain** | Celo mainnet (42220) |
| **Verification** | Passport (strength 100) |
| **Mode** | Linked (agent key tied to human identity) |

```bash
# Verify agent on-chain
curl https://app.ai.self.xyz/api/agent/verify/42220/25

# Get agent info
curl https://app.ai.self.xyz/api/agent/info/42220/25
```

The agent private key is stored in `.env.self` (gitignored) and can be used to sign actions with proof-of-human backing.

## Configuration

| Env Variable | Purpose | Default |
|-------------|---------|---------|
| `NEXT_PUBLIC_SELF_ENDPOINT` | Callback URL for Self proofs | `https://0xdead.church/v1/sermon/anonymous/callback` |
| `SELF_VERIFY_ENDPOINT` | Server-side verification endpoint | Same as above |
| `NEXT_PUBLIC_ACTIVE_CHAIN` | `mainnet` = real passports, other = mock | `sepolia` |

## Testing with Mock Passports

On testnet (Celo Sepolia / staging), Self Protocol supports mock passport proofs for testing. Set `NEXT_PUBLIC_ACTIVE_CHAIN` to anything other than `mainnet` to enable mock mode.

The `PrivatePrayerToggle` component includes a "(Demo: simulate proof for testing)" button for hackathon demonstrations.

## Resources

- [Self Protocol Docs](https://docs.self.xyz)
- [Self Integration Boilerplate](https://github.com/selfxyz/self-integration-boilerplate)
- [Contract Integration Guide](https://docs.self.xyz/contract-integration/basic-integration)
- [Self Protocol GitHub](https://github.com/selfxyz/self)
- [Celo Hub V2 (Testnet)](https://alfajores.celoscan.io/address/0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74)
- [Celo Hub V2 (Mainnet)](https://celoscan.io/address/0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF)
