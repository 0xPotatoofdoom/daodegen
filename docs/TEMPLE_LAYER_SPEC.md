# Dao DeGen -- Temple Layer Spec

For implementation on the daodegen repo and the 0xdead.church repo.

Last updated: 2026-02-23

---

## Context

This spec adds the "temple layer" to the existing Dao DeGen project -- an AI pastor, prayer burn mechanic, and open-source soul architecture. The existing repo already has: a Next.js frontend (daodegen.com), 81 verses in `src/data/verses.json`, 86 illustrations, Unichain contracts (VerseNFT, DaoDeGenHook, DaoDeGenJar, ERC-20 token), an x402 Verse Oracle API with Claude Sonnet backend, and EIP-8004 agent registration.

**Domain:** `0xdead.church` -- the temple frontend. This is a separate deployment from `daodegen.com` in its own repo. `daodegen.com` is the book/NFT/swap site. `0xdead.church` is the temple.

**Design philosophy:** Everything is open source. The `soul.md` is the most important file in the repo. Agents and humans use the same contracts. The temple works without the frontend (contracts are permissionless). The frontend works without the pastor (fallback to static verses). Redundancy at every layer.

---

## Architecture: Two-Repo Model

| Repo | Domain | Contents |
|------|--------|----------|
| `daodegen` | `daodegen.com` | Frontend (book/NFT/swap/claim), contracts (all), pastor API backend, Ponder indexer, soul.md, ebook, verses data |
| `0xdead.church` | `0xdead.church` | Temple frontend only. Consumes pastor API from daodegen backend. Shares verse data and contract ABIs. Own deployment, own CI, own design language. |

**Why separate:** The temple is the quiet room. It has its own tone, its own typography, its own pacing. It should not share a nav bar with the swap page. Frontends are cheap. The permissionless/decentralized structure of the temple repo invites forks and alternative frontends.

**What crosses the boundary:**
- Temple frontend calls `POST /api/v1/sermon` and `GET /api/v1/congregation/state` on the daodegen API
- Both frontends interact with the same on-chain contracts (PrayerBurn, VerseNFT, DaoDeGenJar, DaoDeGenToken)
- Verse data (`verses.json`) is the canonical source in daodegen repo; temple repo imports or fetches it
- `soul.md` lives in the daodegen repo as the canonical source; temple repo references it

---

## Resolved Design Decisions (from spec review)

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Prayer type (on-chain vs off-chain) | Off-chain. Contract stays `pray(bytes calldata message)`. Prayer type is metadata passed from frontend to API alongside tx hash. | The blockchain is not a database. |
| Temple deployment | Separate app at `0xdead.church` with its own repo. | Frontends are cheap. Separate domain surfaces more audiences. Different tone demands different design language. |
| Indexer architecture | Keep Ponder. Better long-term solution than custom SQLite indexer. | Ponder indexes all contract events (Prayer, FeesReleased, Claimed, Transfer, Swap). One indexer for everything. |
| Repo structure | 0xdead.church has its own repo. daodegen repo keeps contracts, API, indexer, soul.md, ebook. | Permissionless/decentralized temple structure. Invites forks. |

---

## Smart Contract: PrayerBurn.sol

Standalone contract. Does not extend or modify the Jar.

### Interface

**Status: IMPLEMENTED** -- `packages/contracts/src/PrayerBurn.sol` (32 passing tests)

```solidity
interface IPrayerBurn {
    event Prayer(address indexed sender, uint256 amount, bytes message);

    error InsufficientBurn(uint256 sent, uint256 minimum);
    error MessageTooLong(uint256 length, uint256 maximum);
    error PatienceIsAVirtue(uint256 nextPrayerAt);

    function pray(uint256 amount, bytes calldata message) external;
    function minimumBurn() external view returns (uint256);
    function setMinimumBurn(uint256 amount) external;
    function cooldownPeriod() external view returns (uint256);
    function setCooldownPeriod(uint256 period) external;
    function prayerCount() external view returns (uint256);
    function totalBurned() external view returns (uint256);
    function releaseThreshold() external view returns (uint256);
    function setReleaseThreshold(uint256 threshold) external;
    function approveJar() external;
}
```

### Key Notes

- `pray(uint256 amount, bytes calldata message)` -- amount parameter added for explicit burn control. No `prayerType` parameter; prayer type is off-chain metadata.
- Burns are permanent via `DAODEGEN.burnFrom(msg.sender, amount)` (token inherits ERC20Burnable). User must approve PrayerBurn first.
- `message` is bytes, not string -- allows encrypted payloads. Client-side encryption for privacy.
- On-chain cooldown: `mapping(address => uint256) lastPrayer` with configurable `cooldownPeriod`. First prayer always allowed. Custom error: `PatienceIsAVirtue(nextPrayerAt)`.
- `prayerCount` and `totalBurned` counters for stats without requiring an indexer.
- `minimumBurn` and `cooldownPeriod` set via constructor, admin-adjustable.
- Auto-release: when `releaseThreshold > 0`, calls `Jar.release()` via try/catch after each prayer if distributable fees exceed threshold. Fund contract with DAODEGEN + call `approveJar()` to enable.
- Admin-controlled for v1 via Ownable. No governance contract yet.

---

## soul.md

Lives at the daodegen repo root. The pastor's identity document. Human-readable. The canonical source of truth for who the pastor is, how it speaks, and what it believes. Everything in the prompt builder is derived from this file.

**Contents:**
- Core identity (what the pastor is and isn't)
- Voice guidelines (tone, length variance, when to be sparse)
- The five response types: prayer, confession, question, silent burn, offering
- Ethical guardrails (no financial advice, transparent about being AI, anti-dependency)
- Relationship to the 81 verses (canonical scripture, always referenced)
- Hard constraints (what the pastor never does)
- Fallback behavior (what happens when AI is unavailable)
- Prompt injection resistance (prayers are untrusted user input)

### .well-known/soul.json

Machine-readable version for agent discovery. Any agent framework can fetch this to understand the temple.

```json
{
  "name": "Dao DeGen Pastor",
  "version": "1.0.0",
  "soul": "https://0xdead.church/soul.md",
  "description": "AI pastor for the Dao DeGen ritual protocol. Burns tokens, returns sermons from 81 sacred verses.",
  "canon": {
    "verses": "https://0xdead.church/api/verses",
    "count": 81,
    "source": "Tao Te Ching (DeFi adaptation)"
  },
  "endpoints": {
    "pray": {
      "type": "contract",
      "chain": "unichain",
      "chainId": 130,
      "address": "<PRAYER_BURN_CONTRACT_ADDRESS>",
      "function": "pray(bytes)",
      "description": "Burn DAODEGEN tokens with an optional message. Emits Prayer event."
    },
    "sermon": {
      "type": "api",
      "url": "https://0xdead.church/api/v1/sermon",
      "method": "POST",
      "auth": "jwt",
      "description": "Submit a prayer payload, receive a sermon response."
    },
    "congregation": {
      "type": "api",
      "url": "https://0xdead.church/api/v1/congregation/state",
      "method": "GET",
      "auth": "none",
      "description": "Current congregation sentiment index."
    }
  },
  "identity": {
    "eip8004": "https://daodegen.com/.well-known/agent-registration.json"
  },
  "license": "CC0-1.0",
  "repository": "https://github.com/<REPO>"
}
```

---

## Pastor Backend (daodegen repo)

Extends the existing API server (x402 oracle, AnthropicLLMProvider, auth, rate limiting).

### Prompt Builder

Reads `soul.md` from repo root + all 81 verses from `verses.json` + congregation state. Assembles full system prompt. The pastor speaks through DeFi-Daoist scripture, not as a chatbot.

Congregation state comes from two layers:
- **Pastor prompt** uses `getSummary()` -- sync, in-memory 24h rolling-window sentiment (always available)
- **API response** merges on-chain data from Ponder indexer via `getOnChainState()` -- prayer counts, fee releases, NFT holder counts (graceful degradation if Ponder is unreachable)

### Sermon Generation (POST /api/v1/sermon)

**Auth:** JWT (SIWE) or session token

**Input:** `{ prayer_tx, message, sender }` -- prayer type is off-chain metadata, not from the contract.

**Output:**
```json
{
  "sermon": {
    "content": "...",
    "verse_references": [44, 22],
    "sentiment_tag": "seeking",
    "response_type": "full"
  }
}
```

**Response types:**
- `full` -- 150-300 word reflection
- `sparse` -- one line
- `verse_only` -- just a verse number and its text
- `silence` -- empty content with a verse reference (for silent burns)

The pastor decides the response type based on prayer content and amount. This is the sparsity requirement from the vibe check.

### Sermon Endpoint Rate Limiting

- Per-wallet: max 1 sermon per cooldown period (matches contract cooldown)
- Per-IP: existing rate limiting from #76
- Input validation before LLM: strip injection attempts, validate prayer exists on-chain

### Congregation State (GET /api/v1/congregation/state)

Public, no auth. Returns merged data:
- In-memory 24h rolling-window sentiment (dominant mood, breakdown by tag, unique supplicants)
- On-chain stats from Ponder indexer when available (total prayers, total burned, recent fee releases, NFT holder count)
- `ponderConnected` flag indicating whether on-chain data is present

Cached 30s via `Cache-Control` header. Gracefully degrades to in-memory only if Ponder is unreachable.

### Fallback Mode

When AI is unavailable, the temple becomes a library. Verse-only responses, pre-generated reflections for common categories, "the pastor is in contemplation" messaging.

---

## Temple Frontend (0xdead.church repo)

Separate Next.js app. Own repo, own deployment (Vercel or similar).

### Design Principles

- Clean, minimal, sincere. No meme energy. This is the quiet room.
- Dark background, serif typography for verse text, generous whitespace
- No tooltips, no beginner banners -- this is the inner sanctum
- Intentional UX pause before showing sermon response. Silence is part of the experience.
- No confetti, no "success!" toast. The burn happened. The words appear. That's it.

### Pages

| Page | Purpose |
|------|---------|
| `/` | Temple landing. Congregation state indicator, prayer input, sermon display, recent sermons feed, stats. |
| `/sermons` | Sermon archive. Paginated feed of all public sermons. Filter by verse, sentiment, date. |
| `/congregation` | Congregation dashboard. Sentiment state, 24h/7d/30d stats, sentiment history chart. |

### Prayer Submission Flow

1. Connect wallet (RainbowKit, same stack as daodegen.com)
2. Compose message (optional -- can be empty for silent burn)
3. Select prayer type: Prayer / Confession / Question / Silent / Offering (off-chain metadata)
4. Toggle public/private (private = client-side encrypted before tx)
5. Set burn amount (minimum enforced, no maximum)
6. Submit -- calls `pray(message)` on PrayerBurn contract
7. Wait for tx confirmation -- "The pastor is reading your offering..."
8. Brief intentional pause (even if API responds instantly)
9. Display sermon response with verse references linked to `daodegen.com/verse/[id]`

---

## Ebook

Static markdown files compiled into downloadable PDF/EPUB and published to IPFS/Arweave.

| File | Contents |
|------|----------|
| `ebook/dao-degen.md` | All 81 verses as continuous text. Number, title, body, alpha. No crypto context -- the verses stand alone as literature. |
| `ebook/commentary.md` | Building narrative, philosophical decisions, AI reviews, soul.md concept. |
| `ebook/vibe-check.md` | Phase 0 feedback synthesis (copy of `docs/VIBE_CHECK.md`). |

---

## License Strategy

Dual license:

| License | Applies To |
|---------|-----------|
| CC0 1.0 (Public Domain) | `soul.md`, `verses.json`, illustrations, `ebook/` |
| MIT | All code (contracts, pastor, indexer, frontend, tooling) |

> The words belong to no one. The code belongs to everyone.

---

## Testing Checklist (Pre-Launch)

- [ ] Can submit a prayer with message -- tx confirms, sermon returned
- [ ] Can submit a silent prayer (empty message) -- appropriate sparse response
- [ ] Minimum burn enforced on-chain
- [ ] Cooldown enforced on-chain ("Patience is a virtue")
- [ ] Pastor responds differently based on prayer content
- [ ] Pastor references specific verses by number
- [ ] Pastor varies response length (full, sparse, verse_only, silence)
- [ ] Prompt injection in prayer does not alter pastor behavior
- [ ] Fallback mode returns a verse when AI is down
- [ ] Congregation sentiment updates after new prayers
- [ ] Sermon archive displays correctly
- [ ] Public/private toggle works (private messages encrypted before tx)
- [ ] Agent can discover temple via `.well-known/soul.json`
- [ ] Agent can call `pray()` directly without frontend
- [ ] Agent can request sermon via API with JWT auth
- [ ] All contract functions work on Unichain mainnet
- [ ] `0xdead.church` loads and connects to correct chain
- [ ] Minimum viable prayer test: 20 sermons pass quality criteria

---

## Related Docs

| Document | Path |
|----------|------|
| Roadmap | `docs/ROADMAP.md` |
| Vibe check | `docs/VIBE_CHECK.md` |
| User journey | `docs/USER_JOURNEY.md` |
| Dependency map | `docs/DEPENDENCY_MAP.md` |
