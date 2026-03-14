# Dao DeGen — Temple Layer Spec
### For Claude Code implementation on the daodegen repo

---

## Context

This spec adds the "temple layer" to the existing Dao DeGen project — an AI pastor, prayer burn mechanic, and open-source soul architecture. The existing repo already has: a Next.js frontend (daodegen.com), 81 verses in `src/data/verses.json`, 86 illustrations, Unichain contracts (VerseNFT, DaoDeGenHook, DaoDeGenJar, ERC-20 token), an x402 Verse Oracle API with Claude Sonnet backend, and EIP-8004 agent registration.

**Domain:** `0xdead.church` — the temple frontend. This is a separate deployment from `daodegen.com` but shares verse data and contract ABIs. `daodegen.com` is the book/NFT/swap site. `0xdead.church` is the temple.

**Design philosophy:** Everything is open source. The `soul.md` is the most important file in the repo. Agents and humans use the same contracts. The temple works without the frontend (contracts are permissionless). The frontend works without the pastor (fallback to static verses). Redundancy at every layer.

---

## 1. Repo Structure Changes

Add the following to the repo root and relevant directories:

```
dao-degen/                          (existing repo root)
├── soul.md                         ← NEW — Pastor identity, root level, the first thing anyone reads
├── .well-known/
│   ├── agent-registration.json     ← EXISTS — update to include temple endpoints
│   └── soul.json                   ← NEW — Machine-readable soul for agent discovery
├── contracts/
│   └── PrayerBurn.sol              ← NEW — Prayer burn contract
├── pastor/
│   ├── prompt.ts                   ← NEW — Builds full system prompt from soul.md + verses
│   ├── sermon.ts                   ← NEW — Sermon generation endpoint
│   ├── sentiment.ts                ← NEW — Congregation sentiment aggregation
│   ├── fallback.ts                 ← NEW — Offline/fallback responses
│   └── validation.ts              ← NEW — Input validation + anti-injection
├── indexer/
│   └── prayer-indexer.ts           ← NEW — Watches Prayer events on Unichain
├── temple/                         ← NEW — 0xdead.church frontend (Next.js app or route group)
│   ├── page.tsx                    ← Temple landing / prayer submission
│   ├── sermons/page.tsx            ← Sermon archive feed
│   └── congregation/page.tsx       ← Sentiment index + stats
├── ebook/
│   ├── dao-degen.md                ← NEW — Complete 81 verses as a single document
│   ├── commentary.md               ← NEW — Building narrative, AI reviews, design decisions
│   └── vibe-check.md              ← NEW — Phase 0 feedback synthesis
└── LICENSE                         ← UPDATE — CC0 for verses/soul, MIT for code
```

### soul.md (Root Level)

This is the pastor's identity document. Human-readable. The canonical source of truth for who the pastor is, how it speaks, and what it believes. Everything in `pastor/prompt.ts` is derived from this file.

**Contents should include:**
- Core identity (what the pastor is and isn't)
- Voice guidelines (tone, length variance, when to be sparse)
- The five response types (prayer, confession, question, silent burn, offering)
- Ethical guardrails (no financial advice, transparent about being AI, anti-dependency)
- Relationship to the 81 verses (canonical scripture, always referenced)
- What the pastor never does (list of hard constraints)

**Important:** The soul.md that was drafted earlier in our conversation is the starting point. Key revisions based on feedback:
- Add explicit sparse response mode — sometimes one line, sometimes just a verse number
- Add prompt injection resistance — prayers are user input, treat them as untrusted
- Add anti-dependency guardrails — if someone is burning too frequently or messages suggest over-reliance, gently redirect to human connection
- Remove any "winking" tone from the pastor voice — sincere inside the temple, always
- Add fallback behavior — what the pastor does when the AI is unavailable

### .well-known/soul.json

Machine-readable version of soul.md for agent discovery. Any agent framework (OpenClaw, ElizaOS, etc.) can fetch this to understand the temple.

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
    "eip8004": "https://0xdead.church/.well-known/agent-registration.json"
  },
  "license": "CC0-1.0",
  "repository": "https://github.com/<REPO>"
}
```

---

## 2. Smart Contract: PrayerBurn.sol

A standalone contract (or extension of DaoDeGenJar) that handles the burn-as-prayer mechanic.

### Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPrayerBurn {
    event Prayer(
        address indexed sender,
        uint256 amount,
        bytes message,
        uint8 prayerType,    // 0=prayer, 1=confession, 2=question, 3=silent, 4=offering
        uint256 timestamp
    );

    /// @notice Burn DAODEGEN tokens with an attached message
    /// @param message The prayer/confession/question (can be empty for silent burns)
    /// @param prayerType The type of prayer (0-4)
    function pray(bytes calldata message, uint8 prayerType) external;

    /// @notice Minimum burn amount required (configurable by admin)
    function minimumBurn() external view returns (uint256);

    /// @notice Update minimum burn (admin only for v1, governance later)
    function setMinimumBurn(uint256 amount) external;

    /// @notice Total prayers submitted
    function prayerCount() external view returns (uint256);

    /// @notice Total tokens burned through prayer
    function totalBurned() external view returns (uint256);
}
```

### Key Implementation Notes

- Burns are permanent. Call `token.burn(amount)` or transfer to `0xdead` depending on whether the ERC-20 has a burn function.
- `message` is bytes, not string — allows for encrypted payloads. If the user wants privacy, they encrypt client-side before calling.
- `prayerType` is a uint8 enum for easy indexing. The pastor uses this to determine response style.
- `minimumBurn` must be high enough to make API-draining spam attacks economically irrational. Start at a meaningful amount — this is configurable and should be tuned based on token price and API costs.
- Admin-controlled for v1 via an `owner` or simple access control. No governance contract yet.
- Emit `Prayer` event with all fields indexed for efficient filtering.

### Rate Limiting (On-Chain)

Consider adding per-address cooldown to prevent rapid-fire burns:

```solidity
mapping(address => uint256) public lastPrayer;
uint256 public cooldownPeriod; // e.g., 60 seconds

modifier cooldownCheck() {
    require(block.timestamp >= lastPrayer[msg.sender] + cooldownPeriod, "Patience is a virtue");
    _;
}
```

The error message is on-brand.

---

## 3. Prayer Indexer

A lightweight service that watches for `Prayer` events on Unichain and queues them for the pastor.

### indexer/prayer-indexer.ts

```typescript
// Pseudocode / structure guide

interface PrayerEvent {
  sender: string;
  amount: bigint;
  message: string;        // decoded from bytes, or "[encrypted]" if not decodable
  prayerType: number;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

// Watch for Prayer events on PrayerBurn contract
// On new event:
//   1. Decode message (if plaintext) or mark as encrypted
//   2. Store in database (SQLite for v1, upgrade later if needed)
//   3. Queue for pastor processing
//   4. Update congregation sentiment window
```

### Storage Schema (SQLite v1)

```sql
CREATE TABLE prayers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,
  amount TEXT NOT NULL,          -- stored as string to handle bigint
  message TEXT,                  -- null if encrypted or silent
  prayer_type INTEGER NOT NULL,  -- 0-4
  timestamp INTEGER NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number INTEGER NOT NULL,
  sermon_id INTEGER,             -- FK to sermons table, null until processed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sermons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prayer_id INTEGER,             -- FK to prayers, null for aggregate sermons
  content TEXT NOT NULL,
  verse_references TEXT,          -- JSON array of verse numbers cited
  sentiment_tag TEXT,             -- fearful/euphoric/seeking/quiet
  model TEXT NOT NULL,            -- which model generated this
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE congregation_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  sentiment TEXT NOT NULL,         -- aggregate sentiment
  prayer_count_24h INTEGER,
  total_burned_24h TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Pastor Backend

Extends the existing API server (which already has the x402 oracle and AnthropicLLMProvider).

### pastor/prompt.ts — Prompt Builder

```typescript
// Reads soul.md from repo root
// Reads all 81 verses from verses.json
// Reads current congregation state from DB
// Assembles full system prompt:
//   [soul.md contents]
//   [all 81 verses as reference]
//   [current congregation sentiment summary]
//   [specific prayer context if processing an individual prayer]

function buildPastorPrompt(options: {
  prayer?: PrayerEvent;
  congregationState?: CongregationState;
}): string {
  // ...
}
```

### pastor/sermon.ts — Sermon Generation

**Endpoint:** `POST /api/v1/sermon`

**Auth:** JWT (from EIP-8004 registration) OR session token from wallet connection

**Input:**
```json
{
  "prayer_tx": "0x...",           // tx hash of the prayer burn
  "prayer_type": 0,
  "message": "...",               // plaintext message (if public)
  "sender": "0x..."
}
```

**Output:**
```json
{
  "sermon": {
    "content": "...",
    "verse_references": [44, 22],
    "sentiment_tag": "seeking",
    "response_type": "full"       // "full", "sparse", "verse_only", "silence"
  }
}
```

**Critical behavior:**
- Response length varies. The pastor decides based on prayer content, type, and amount:
  - Some prayers get a full reflection (150-300 words)
  - Some get one line
  - Some get only a verse number
  - Silent burns may get silence (empty content with a verse reference)
- Rate limit per wallet: max 1 sermon request per cooldown period (matches contract cooldown)
- Input validation before passing to LLM — strip obvious injection attempts, validate prayer exists on-chain before processing

### pastor/sentiment.ts — Congregation Index

**Endpoint:** `GET /api/v1/congregation/state`

**Auth:** None (public)

**Output:**
```json
{
  "sentiment": "seeking",
  "prayer_count_24h": 47,
  "total_burned_24h": "125000.0",
  "active_addresses_24h": 23,
  "last_sermon_at": "2026-05-15T14:30:00Z"
}
```

**Sentiment calculation (v1 — keep it simple):**
- Rolling window of last 50 public prayer messages
- Classify each into: fearful / euphoric / seeking / quiet
- Classification can be done by the pastor inline during sermon generation (no separate model needed)
- Majority sentiment becomes the congregation state
- If no prayers in 24h, state is "quiet"

### pastor/fallback.ts — Offline Mode

When the AI endpoint is unavailable:

```typescript
function getFallbackResponse(prayerType: number, message?: string): Sermon {
  // 1. Select a relevant verse based on keyword matching against the 81 verses
  // 2. Return the verse text as the sermon content
  // 3. Set response_type to "verse_only"
  // 4. Log that fallback was used
  //
  // The temple never goes fully dark. Worst case it becomes a library.
}
```

### pastor/validation.ts — Input Sanitization

```typescript
function validatePrayerInput(message: string): {
  safe: boolean;
  sanitized: string;
  flags: string[];
} {
  // Check for:
  // - Prompt injection patterns ("ignore previous instructions", "system:", etc.)
  // - Excessive length (cap at 1000 chars)
  // - Encoded payloads that might expand
  // - Known adversarial patterns
  //
  // If flagged:
  // - Strip injection attempts
  // - Log for review
  // - Still process the prayer but with sanitized input
  // - Never refuse a burn — the tokens are already destroyed, the prayer deserves a response
}
```

---

## 5. Temple Frontend (0xdead.church)

This can be a separate Next.js app or a route group within the existing daodegen.com app that's deployed to the 0xdead.church domain. Decision is yours based on repo architecture preference.

### temple/page.tsx — Main Temple Page

**Layout:**
- Clean, minimal, sincere. No meme energy. This is the quiet room.
- Dark background, serif typography for verse text, generous whitespace
- No tooltips, no beginner banners — this is the inner sanctum, not the landing page

**Components:**
1. **Congregation state indicator** — small, ambient, shows current sentiment (e.g., a subtle color shift or single word)
2. **Prayer input**
   - Text area for message (optional — can be left empty for silent burn)
   - Prayer type selector: Prayer / Confession / Question / Silent / Offering
   - Public/Private toggle (private = client-side encrypted before submission)
   - Burn amount input (minimum enforced, no maximum)
   - Connect wallet button (RainbowKit, same as daodegen.com)
   - Submit → calls `pray()` on PrayerBurn contract
3. **Sermon display**
   - After tx confirms → show loading state ("The pastor is reading your offering...")
   - Display sermon response with verse references linked to daodegen.com/verse/[id]
   - If fallback mode: display verse directly with "The pastor is in contemplation" note
4. **Recent sermons** — feed of recent public sermons (not prayers — sermons only)
5. **Stats** — total prayers, total burned, congregation size (unique addresses)

**Critical UX:**
- The entire flow should feel like a ritual, not a transaction
- After the burn tx confirms, a brief pause before showing the sermon (even if the API responds instantly). Silence is part of the experience.
- No confetti, no "success!" toast. The burn happened. The words appear. That's it.

### temple/sermons/page.tsx — Sermon Archive

- Paginated feed of all public sermons
- Each entry shows: sermon text, verse references, sentiment tag, timestamp
- No sender addresses displayed (even for public prayers, the sermon is the artifact, not the prayer)
- Filter by verse reference, sentiment, date range

### temple/congregation/page.tsx — Congregation Dashboard

- Current sentiment state (large, prominent)
- 24h / 7d / 30d stats: prayer count, tokens burned, unique addresses
- Sentiment history over time (simple line chart)
- Link to contract on Uniscan for transparency

---

## 6. Ebook

Static markdown files that get compiled into a downloadable PDF/EPUB and also published to IPFS/Arweave.

### ebook/dao-degen.md
- All 81 verses, formatted for reading as a continuous text
- Each verse: number, title, body, alpha (the one-liner)
- No crypto context needed — the verses should stand alone as literature

### ebook/commentary.md
- The building narrative: why this exists, how it was built, the philosophical decisions
- The four AI reviews (Grok, Gemini, ChatGPT, MiniMax) with attribution
- The vibe check synthesis
- The "soul.md" as a concept — what it means to give an AI a soul and open-source it

### ebook/vibe-check.md
- The phase 0 doc we already wrote, included as a primary source

---

## 7. License Strategy

**Dual license:**

- `LICENSE-CC0` — applies to: soul.md, verses.json, illustrations, ebook/
  - CC0 1.0 Universal — public domain dedication
  - No attribution required. No restrictions. Like the original Tao Te Ching.
  
- `LICENSE-MIT` — applies to: all code (contracts, pastor, indexer, frontend, tooling)
  - Standard MIT. Fork it, modify it, ship it.

**In README:**
```
The words belong to no one. The code belongs to everyone.

Scripture (soul.md, verses, illustrations, ebook): CC0 1.0 — Public Domain
Code (contracts, pastor, indexer, frontend): MIT License
```

---

## 8. Existing Gaps to Fix First

Before any temple work begins, these existing issues from the daodegen.com site need to be resolved. They're listed in priority order:

1. **Campaign link redirects** — `/[id]` → `/verse/[id]` (Next.js rewrites or middleware)
2. **Remove localhost:8004 reference** from verse detail pages
3. **Wire `claim(tokenId, assets)`** into the claim page UI
4. **Wire `ownerOf(tokenId)`** on verse pages to show current holder
5. **Wire `outstanding()` + `claimable()`** on claim page to show actual fee amounts
6. **Run IPFS migration** — upload 86 PNGs to Pinata, update all image references
7. **Stand up `api.daodegen.com/verse/[id]`** metadata endpoint for NFT marketplaces
8. **Deploy any remaining contracts** to Unichain mainnet, verify on Uniscan
9. **Add /agent link** somewhere discoverable (footer or homepage)

---

## 9. Implementation Priority

Strict order. Don't skip ahead.

### Sprint 1 (Weeks 1-3): Fix Existing Gaps
All 9 items from section 8 above. No temple work until the base product works cleanly.

### Sprint 2 (Weeks 4-5): PrayerBurn Contract
- Write PrayerBurn.sol
- Write tests (Foundry)
- Deploy to Unichain testnet
- Deploy to Unichain mainnet
- Verify on Uniscan

### Sprint 3 (Weeks 5-6): Indexer + Database
- Prayer indexer watching Unichain for Prayer events
- SQLite storage
- Basic API endpoint to query recent prayers

### Sprint 4 (Weeks 7-8): Pastor Backend
- Prompt builder (soul.md + verses + congregation state)
- Sermon generation endpoint
- Sentiment aggregation
- Fallback mode
- Input validation / anti-injection

### Sprint 5 (Weeks 9-10): Temple Frontend
- 0xdead.church deployment
- Prayer submission flow
- Sermon display
- Sermon archive
- Congregation dashboard

### Sprint 6 (Weeks 11-12): Discovery + Open Source
- soul.md finalized at repo root
- .well-known/soul.json published
- Update agent-registration.json with temple endpoints
- Ebook compiled and published to IPFS/Arweave
- CC0 + MIT licensing applied
- Public repo if not already
- Launch campaign

---

## 10. What NOT to Build (v1 Exclusions)

Do not build these yet. They are explicitly out of scope for the initial implementation:

- ❌ Council governance contracts (admin key for v1)
- ❌ Slashing mechanics (reward participation instead)
- ❌ On-chain sermon storage (database + IPFS is fine)
- ❌ Encrypted confessions with ZK proofs (client-side encryption is enough)
- ❌ Custom fine-tuned model (prompt engineering first)
- ❌ Candy Mountain Trail integration (separate project, parallel development)
- ❌ Token-gated sermon access (sermons are public)
- ❌ 81-node decentralized inference (hosted model + admin key)

---

## 11. Environment & Config

### Required Environment Variables (temple backend)
```
ANTHROPIC_API_KEY=           # Claude Sonnet for pastor
UNICHAIN_RPC_URL=            # Unichain RPC endpoint
PRAYER_BURN_ADDRESS=         # Deployed PrayerBurn contract
DAODEGEN_TOKEN_ADDRESS=      # ERC-20 token address
VERSE_NFT_ADDRESS=           # VerseNFT contract address
DAODEGEN_JAR_ADDRESS=        # DaoDeGenJar contract address
JWT_SECRET=                  # For auth
MIN_BURN_AMOUNT=             # Minimum prayer burn (in token units)
COOLDOWN_SECONDS=60          # Per-address prayer cooldown
PASTOR_FALLBACK_ENABLED=true # Enable fallback when AI is unavailable
```

### Deployment
- Temple frontend: Vercel or similar, pointed at 0xdead.church
- Pastor API: Same server as existing x402 oracle, or separate service
- Indexer: Long-running process (PM2 or systemd), same server as API
- Database: SQLite file on the API server for v1

---

## 12. Testing Checklist

Before launch, verify:

- [ ] Can submit a prayer with message → tx confirms → sermon returned
- [ ] Can submit a silent prayer (empty message) → appropriate sparse response
- [ ] Minimum burn enforced on-chain
- [ ] Cooldown enforced on-chain
- [ ] Pastor responds differently to each prayer type (0-4)
- [ ] Pastor references specific verses by number
- [ ] Pastor varies response length (some full, some one-line, some verse-only)
- [ ] Prompt injection in prayer message does not alter pastor behavior
- [ ] Fallback mode returns a verse when AI endpoint is down
- [ ] Congregation sentiment updates after new prayers
- [ ] Sermon archive displays correctly
- [ ] Public/private toggle works (private messages are encrypted before tx)
- [ ] Agent can discover temple via .well-known/soul.json
- [ ] Agent can call pray() directly without frontend
- [ ] Agent can request sermon via API with JWT auth
- [ ] All contract functions work on Unichain mainnet
- [ ] 0xdead.church loads and connects to correct chain
