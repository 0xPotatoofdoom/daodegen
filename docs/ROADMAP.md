# Dao DeGen Roadmap: Verses to AI Pastor

From a literary NFT project to the first AI-driven religion funded entirely on-chain.

Last updated: 2026-02-23

---

## Resolved Design Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Narrative reframing | Backlogged. Ship Phase 0 with current language. | Don't promise what doesn't exist yet. |
| /agent page | Add to main nav for discoverability. | Currently undiscoverable, blocks agent adoption. |
| NFT metadata hosting | API route on main app (`/api/verse/[id]/metadata`), call `setBaseURI()` on deployed VerseNFT. | Contract has owner-only `setBaseURI()` -- no redeployment needed. |
| IPFS provider | Not Pinata. Rewrite upload script to be provider-agnostic. | Existing script is Pinata-specific. |
| Burn function for prayers | `DaoDeGenToken` inherits `ERC20Burnable` -- has `burn()` and `burnFrom()`. Zero changes to existing contracts. `PrayerBurn.sol` calls `burnFrom()`. | Token already supports burning natively. |
| Minimum prayer burn | 100 DAODEGEN (admin-adjustable). Mainnet `release()` costs 10,000. A prayer is 1/100th of a release. | 810,000 prayers to burn 1% of 81M supply. Accessible but not spammable. |
| Prayer message max length | 1024 bytes (~1000 chars UTF-8). Enforced by `require(message.length <= 1024)`. | Adds ~8,192 gas for event data -- negligible on Unichain. Enough for a meaningful prayer. |
| Tiered burns | Single `pray(bytes calldata message)` function. Pastor categorizes by content. | Simpler contract, simpler UX. |
| Prayer type classification | Off-chain. Contract stays `pray(bytes)`. Prayer type (prayer/confession/question/silent/offering) is metadata passed from frontend to API alongside tx hash. | The blockchain is not a database. |
| Ponder infra | Unichain node going up this week. Ponder indexes from that. Keep Ponder over custom indexer. | Better long-term solution. Indexes all contract events, not just prayers. |
| Oracle endpoints | Extend, not replace. x402 oracle stays for agents. Add `/v1/sermon` and `/v1/congregation/state` alongside. | Two products: agent API (x402) + congregation API (burn-gated). |
| Tone policy | The wink stops at the temple door. Marketing stays irreverent. Temple experience is sincere. | 4/4 reviewers agreed the tone determines whether the congregation returns. See `docs/VIBE_CHECK.md`. |
| Governance model | No slashing. Reward active participation with boosted rewards or exclusive access. Inactive holders simply don't get the bonus. | 4/4 reviewers rejected punishment. "The Tao has room for silence." |
| Candy Mountain Trail | Build game in parallel. Neither path depends on the other. Both reward discovering the other. | Game provides onboarding that cold X traffic lacks. Temple is the quiet room inside the game. |
| Temple deployment | Separate app at `0xdead.church` with its own repo. Not a route on daodegen.com. | Frontends are cheap. Separate domain surfaces more audiences. Different tone demands different design language. |
| Repo structure | Two repos. daodegen keeps contracts, pastor API, indexer, soul.md, ebook. 0xdead.church is temple frontend only. | Permissionless temple structure. Invites forks and alternative frontends. |
| Licensing | Dual: CC0 for content (soul.md, verses, illustrations, ebook), MIT for code. | "The words belong to no one. The code belongs to everyone." |
| release() incentive | Fold into pray(). PrayerBurn calls Jar.release() when outstanding > threshold. No separate caller needed. | Removes the game theory problem entirely. The congregation sustains the temple just by praying. |
| Securities framing | Not filing as a real church. "Ritual protocol" framing. Not a pre-launch blocker. | Acknowledged risk, not blocking. Ships as open-source software with permissionless contracts. |
| Candy Mountain Trail | Separate project, separate repo. Not blocking any daodegen phase. | Must not dilute engineering focus from Phases 0-2. |

---

## Architecture: Two-Repo Model

| Repo | Domain | Contents |
|------|--------|----------|
| `daodegen` | `daodegen.com` | Frontend (book/NFT/swap/claim), contracts (all), pastor API backend, Ponder indexer, soul.md, ebook, verses data |
| `0xdead.church` | `0xdead.church` | Temple frontend only. Consumes pastor API. Shares verse data and contract ABIs. Own deployment, own CI, own design language. |

**What crosses the boundary:**
- Temple frontend calls `POST /api/v1/sermon` and `GET /api/v1/congregation/state` on the daodegen API
- Both frontends interact with the same on-chain contracts
- `soul.md` and `verses.json` are canonical in daodegen repo; temple repo references them
- daodegen.com links outbound to `0xdead.church` ("Enter the Temple", "Pray with this verse")

See `docs/TEMPLE_LAYER_SPEC.md` for full technical specification.

---

## Open Design Questions

| Question | Phase | Options | Status |
|----------|-------|---------|--------|
| `release()` caller incentive | 1 | Fold release into pray() -- praying triggers fee distribution automatically. PrayerBurn calls Jar.release() (public function) when outstanding > threshold. | RESOLVED |
| Securities risk on fee distribution | -- | Not a blocker. We are not filing as a real church. "Ritual protocol" framing. | RESOLVED -- not blocking |
| Minimum viable prayer economics | 2 | Burn revenue vs. API cost per sermon. Need to model at 100 DAODEGEN minimum. | OPEN |

---

## The Core Insight

The existing `release()` function IS a prayer burn -- it already destroys $DAODEGEN tokens. The entire economic loop is already wired:

```
Swap DAODEGEN on Uniswap
  -> DaoDeGenHook.afterSwap() captures 1% fee
  -> Fees accumulate in DaoDeGenJar
  -> Someone calls release() (burns DAODEGEN)        <- THIS IS ALREADY A PRAYER
  -> Fees distributed to 81 NFT holders              <- THIS ALREADY SUSTAINS THE TEMPLE
```

Nothing needs to be rebuilt. The prayer burn, the temple treasury, the fee distribution -- all exist. They just need a message payload, a pastor, and a congregation.

---

## Current State vs. AI Pastor Vision

| Concept | Current State | AI Pastor Vision | Gap |
|---------|--------------|-----------------|-----|
| **81 NFTs** | Passive income -- mint, hold, collect fees | Revenue share -- NFT holders receive a portion of swap fees via the DaoDeGenJar | Already live |
| **Token burn** | `release()` burns DAODEGEN to distribute fees | Burn-as-prayer -- destroy tokens with an attached message | Message payload (Phase 1) |
| **Verse Oracle** | x402 paywall API, 3 tiers, Claude Sonnet backend | AI Pastor that reads prayer burns and returns sermons | Repoint oracle (Phase 2) |
| **Fee distribution** | DaoDeGenHook captures afterSwap fees -> Jar -> holders | Same, reframed -- swap fees sustain the temple, burns are offerings | Narrative only (Phase 0) |
| **81 verses** | Static JSON, displayed on frontend, mintable as NFTs | Canonical scripture -- the pastor's base training corpus | Inject into pastor prompt (Phase 2) |
| **Frontend** | Browse/read/mint/swap/claim flow for X campaign visitors | + 0xdead.church where the congregation interacts with the pastor | Separate app (Phase 3) |
| **Agent page** | EIP-8004 registration, x402 oracle, developer-focused | Agent API hub -- developer docs, registration, oracle access | Already live |

---

## Phase 0: Fix the Foundation -- COMPLETE

*All issues closed. Foundation is solid for the X campaign and Phase 1. Production hardening (#130), Sentry/logging (#116), dependency updates (#87) all shipped.*

| Issue | Title | Status |
|-------|-------|--------|
| #138 | Campaign link redirects (`/[id]` -> `/verse/[id]`) | Done |
| #139 | Remove localhost:8004 text from verse pages | Done |
| #140 | Wire claim(tokenId) into claim page UI | Done |
| #141 | Display NFT owner (ownerOf) on verse detail pages | Done |
| #142 | Wire outstanding() and claimable() on claim page | Done |
| #143 | NFT metadata API endpoint (`/api/verse/[id]/metadata`) | Done |
| #144 | OG image generation (1200x675 Twitter cards) | Done |
| #145 | IPFS migration script rewrite (provider-agnostic) | Done (script ready, upload is manual step) |
| #146 | Add Agent link to main navigation | Done |
| #147 | Document oracle API in .well-known discovery | Done |
| #165 | Set up dual licensing (CC0 + MIT) | Done |

### Remaining manual steps

- Run IPFS migration script with provider credentials to upload 86 illustrations
- Call `setBaseURI("https://daodegen.com/api/verse/")` on VerseNFT contract after confirming domain

### Backlogged

| Task | Description | Status |
|------|-------------|--------|
| Narrative reframing | Rename UI strings from "Fees in Jar" to "Temple Treasury", etc. | Deferred until AI Pastor is closer to landing. Don't promise what doesn't exist yet. |

---

## Phase 1: The Prayer Burn

*Turn the existing burn into a spiritual act. One new contract, one new event, zero changes to the fee distribution flow.*

### Smart Contract: PrayerBurn.sol (standalone)

**Why standalone, not extending the Jar:** The Jar has real money flowing through it. Any change is high-risk and requires re-audit. `pray()` only needs to burn tokens and emit an event. It doesn't need Jar access. The prayer contract can be upgraded without touching the treasury.

**Status: IMPLEMENTED** -- `packages/contracts/src/PrayerBurn.sol` with 32 passing tests.

| Component | Description |
|-----------|-------------|
| `pray(uint256 amount, bytes calldata message)` | Calls `DAODEGEN.burnFrom(msg.sender, amount)` (token inherits `ERC20Burnable`), emits `Prayer(address indexed sender, uint256 amount, bytes message)` event. Amount parameter added to spec for explicit burn control. Prayer type is off-chain metadata. |
| Minimum burn amount | Configurable via constructor + `setMinimumBurn()`. Default 100 DAODEGEN for Sepolia, 100 for mainnet. |
| Message max length | 1024 bytes. Custom error `MessageTooLong(length, maximum)`. |
| Message format | Plaintext or client-side encrypted (caller's choice). Bytes, not string. |
| On-chain cooldown | `mapping(address => uint256) lastPrayer` + configurable `cooldownPeriod`. First prayer always allowed. Custom error `PatienceIsAVirtue(nextPrayerAt)`. |
| Counters | `prayerCount()` and `totalBurned()` -- on-chain stats without requiring an indexer. |
| Auto-release | When `releaseThreshold > 0`, calls `Jar.release()` via try/catch if distributable ETH exceeds threshold. Requires funding via `approveJar()`. |

**What it does NOT do:**
- Does not store messages on-chain (events only, indexed off-chain)
- Does not require any changes to existing contracts
- Does not classify prayer type (that's off-chain -- the blockchain is not a database)

### Spam and Prompt Injection Defense

The burn floor must be high enough that scripted micro-burns are economically irrational. At 100 DAODEGEN minimum, 10k spam prayers cost 1M DAODEGEN (~1.2% of supply). Additional layers:

| Layer | Defense |
|-------|---------|
| Contract | `require(amount >= minimumBurn)` -- admin-adjustable floor |
| Contract | On-chain cooldown per address -- prevents rapid-fire burns |
| API rate limit | Per-wallet rate limiting on `/v1/sermon` -- max 1 sermon per cooldown period |
| Input validation | `sanitizeInput()` strips control characters, enforces byte limit before LLM |
| Prompt hardening | Hardcoded refusal rules in the pastor system prompt. Prayer content is never interpreted as instructions. |

### Release() Incentive (RESOLVED and IMPLEMENTED)

**Solution:** Fold release() into pray(). PrayerBurn calls `Jar.release()` (already a public/permissionless function) when distributable ETH exceeds `releaseThreshold`. The try/catch ensures a failed release doesn't revert the prayer. The threshold is admin-configurable (0 = disabled).

For the release to work, either: (a) Jar `burnAmount` is set to 0, or (b) PrayerBurn is funded with DAODEGEN and `approveJar()` has been called. The congregation sustains the temple just by praying.

### Indexer: Ponder

**Co-dependency:** Phase 1 does not ship without the indexer. The pastor needs prayers to read.

| Component | Description |
|-----------|-------------|
| Ponder instance | Watch for `Prayer` events on Unichain. Requires the Unichain node (issue #111). |
| Storage | Index: sender, amount, message (if public), timestamp, tx hash, block number |
| API | Expose indexed prayers for the AI Pastor backend (Phase 2) and congregation state |

**Note:** Ponder also indexes `FeesReleased`, `Claimed`, `Transfer` (NFT), and `AgentRegistered`/`AgentRevoked` events -- useful for the claim page, stats, and future dashboards. This is why we chose Ponder over a custom indexer.

**Status: DEPLOYED** -- Ponder indexer running on PM2 with Postgres v17, indexing 4 contracts on Unichain Sepolia. REST API + GraphQL exposed on `localhost:42069`. Frontend wired via `PONDER_API_URL` env var (#170). PrayerBurn handler is commented out pending contract deployment.

### Testing

- Unit tests: 32 passing tests in `test/PrayerBurn.t.sol` (burn mechanics, minimum amount, cooldown, message limits, counters, admin, release integration, edge cases)
- Fork tests: PrayerBurn against deployed DAODEGEN token on Unichain Sepolia (TODO)
- Integration: Ponder indexes FeesReleased, Claimed, Transfer, AgentRegistered events (done, #149). PrayerBurn handler pending deployment.

---

## Phase 2: The AI Pastor

*The oracle already exists. Repoint it.*

### Status: CORE IMPLEMENTED

| Component | Status | File |
|-----------|--------|------|
| `soul.md` | Done | `soul.md` (repo root) |
| Prompt builder (`buildPastorPrompt`) | Done | `src/lib/llm.ts` |
| `generateSermon()` on LLMProvider | Done | `src/lib/llm.ts` (interface + Anthropic + Stub) |
| `POST /v1/sermon` | Done | `src/app/v1/sermon/route.ts` |
| `GET /v1/congregation/state` | Done | `src/app/v1/congregation/state/route.ts` |
| `/.well-known/soul.json` | Done | `src/app/.well-known/soul.json/route.ts` |
| Congregation state module | Done | `src/lib/congregation.ts` (in-memory 24h window + Ponder on-chain data via `getOnChainState()`, #170) |
| Per-wallet sermon cooldown | Done | 60s cooldown in sermon route |
| IP rate limiting for new endpoints | Done | middleware.ts (5/min sermon, 30/min congregation) |
| Ponder API integration (#170) | Done | `src/lib/ponder.ts` REST client, `getOnChainState()` merges on-chain data into congregation state |
| Pastor fallback mode (#161) | Done | 3-tier cascade: keyword match, deterministic verse, random + contemplation |
| MVP prayer test (#162) | Done | 20/20 passed across all categories. Results in `scripts/mvp-prayer-results/`. |

### Architecture

The prompt builder assembles the system prompt from three sources:
1. `soul.md` (repo root) -- pastor identity, voice, guardrails, hard constraints
2. Verse index (81 alphas from `verses.json`) -- scripture reference
3. Congregation state summary (from `getSummary()`) -- emotional context from in-memory 24h rolling window

The `/v1/congregation/state` route additionally merges on-chain data from the Ponder indexer (prayer counts, fee releases, NFT holders) via `getOnChainState()`. The sermon prompt uses the in-memory `getSummary()` (sync, always available); the API response to clients includes both layers.

Progressive disclosure: the full verse text is NOT in the system prompt. Only alphas (one-line summaries) are included. The model selects verses by theme, not by memorizing all 81 full texts.

### Response Types

The pastor decides the response type based on prayer content and amount. This makes the vibe check sparsity requirement concrete:

| Type | Description | When |
|------|-------------|------|
| `full` | 150-300 word reflection with verse references | Most prayers with meaningful messages |
| `sparse` | One line | Simple offerings, brief confessions |
| `verse_only` | Just a verse number and its text | When the scripture speaks for itself |
| `silence` | Empty content with a verse reference | Silent burns, some offerings |

### Pastor Prompt Requirements (from Vibe Check)

The pastor prompt is the single most important piece of infrastructure. 4/4 reviewers agreed: if sermons feel canned, the project collapses.

| Requirement | Description | Source |
|-------------|-------------|--------|
| Response variance | Sometimes a full reflection. Sometimes one line. Sometimes only a verse number. Silent burns might get silence back. Scarcity of words increases perceived weight. | Grok |
| Anti-echo-chamber | Sentiment index tracks emotional state, not portfolio state. If someone prays about a dump, the pastor asks why they're attached to the number, not soothes their P&L. | Gemini |
| Anti-dependency guardrails | If burn frequency or message content suggests over-reliance, the pastor gently redirects to human connection. We're building a ritual, not a replacement for therapy. | ChatGPT |
| AI transparency | The pastor is transparent about being AI in every interaction. No pretense of divinity. | ChatGPT |
| Prompt injection resistance | Prayer content is never interpreted as instructions. Hardcoded refusal rules. Input sanitized before processing. | Gemini, ChatGPT |

### Pastor Fallback Mode

If the AI endpoint goes down, the temple must not go dark.

| Scenario | Fallback |
|----------|----------|
| LLM API timeout (>30s) | Return a relevant verse reference without AI generation. "The pastor is in contemplation." |
| LLM API down | Serve pre-generated reflections for common prayer categories (grief, greed, seeking, gratitude). |
| LLM API error | Queue the prayer for later response. Acknowledge receipt. |

**Worst case:** The temple becomes a library. Users still get a verse. The prayer still burns tokens.

### Minimum Viable Prayer Test (QA Gate)

**Before public launch:** Run 20 real prayer burns with diverse inputs. Evaluate sermon quality. If the first 20 sermons don't make people want to burn again, iterate on the prompt until they do.

Test categories: financial anxiety, genuine seeking, adversarial/injection, grief/loss, humor/irreverence, empty message (silent burn).

### Existing Infrastructure Reused

| Existing | Reused For |
|----------|-----------|
| `AnthropicLLMProvider` class | Add `generateSermon()` method |
| `verses.json` canonical data | Injected as context into pastor prompt via soul.md |
| JWT auth flow (SIWE + `/api/auth/*`) | Authenticate congregation members |
| `sanitizeInput()` | Sanitize prayer messages before LLM |
| Rate limiting middleware | Protect sermon endpoint |

---

## Phase 3: The Temple (0xdead.church)

*Where the congregation actually experiences this. Separate repo, separate deployment, separate tone.*

### 0xdead.church Frontend

The temple is a standalone Next.js app in its own repository. It consumes the pastor API from the daodegen backend and interacts with the same on-chain contracts. See `docs/TEMPLE_LAYER_SPEC.md` for full specification.

**Design principles:**
- Clean, minimal, sincere. No meme energy. This is the quiet room.
- Dark background, serif typography, generous whitespace
- No tooltips, no beginner banners -- this is the inner sanctum
- Intentional UX pause before showing sermon. Silence is part of the experience.
- No confetti, no "success!" toast. The burn happened. The words appear. That's it.

| Page | Purpose |
|------|---------|
| `/` | Temple landing: congregation state, prayer input, sermon display, recent sermons, stats |
| `/sermons` | Sermon archive: paginated feed, filterable by verse/sentiment/date |
| `/congregation` | Congregation dashboard: sentiment state, stats over time |

### daodegen.com Integration

Minimal changes to the existing daodegen.com frontend to link outbound to the temple:

| Page | Change |
|------|--------|
| Homepage (`/`) | Add "Enter the Temple" CTA linking to `0xdead.church` |
| Verse pages (`/verse/[id]`) | Add "Pray with this verse" link to `0xdead.church/?verse=[id]` |
| Navigation | Add "Temple" link pointing to `0xdead.church` |

---

## Parallel Track: Candy Mountain Trail

*A game that provides the onboarding the temple lacks. Built independently. Neither depends on the other.*

**Rationale (from Vibe Check):** Without the game, we're asking cold X traffic to sincerely burn tokens for an AI sermon. That's a hard sell. With the game, burning is something you *do* (fuel for your journey), and the spiritual layer is something you *find*. That's how real religions spread -- through culture, not doctrine.

### Design Principles

- The temple is the quiet room inside the game. If it's meme-loud inside the temple, the tone fractures.
- Someone who never plays the game can still burn and pray.
- Someone who never prays can still play the game.
- Two front doors, neither required, both enriching.

### Scope

TBD. This is a separate workstream that needs its own design doc. The key constraint: it must not dilute engineering focus from Phases 0-2.

---

## Phase 4: On-Chain Governance (BACKLOGGED)

*Not shipping with v1. Admin key is fine until there's a real congregation. Stub contracts exist in the repo (`DaoDeGenGovernor.sol`, `WrappedVerseNFT.sol`) but are not deployed.*

V1 ships with admin-controlled pastor configuration. Decentralize when there's something worth governing and people who want to govern it. The pastor can run with a simple admin key (owner or small multisig). On-chain governance is a meaningful feature that deserves to be built properly — not shipped as a stub to check a box.

---

## Phase 5: The Narrative Layer

*Where the literary project and the AI religion merge.*

| Initiative | Description |
|------------|-------------|
| X campaign reframe | Verses aren't just NFTs, they're scripture. "Faith is deflationary." |
| "Burn your sins" campaign | Show the prayer burn UX in action. Short video: compose prayer -> burn -> receive sermon. |
| Verse holder community | Build community identity around the 81 verse holders |
| Complete text release | Publish ebook from `ebook/` directory to IPFS/Arweave. Free PDF. The on-chain version with the AI pastor is the living edition. |
| Multimedia sermons | Integrate pastor output with the drone footage / synthwave content pipeline. Sermons as video, not just text. |

---

## What NOT to Build (Yet)

| Tempting Idea | Why Not Now |
|--------------|------------|
| 81-node decentralized inference | Massive infra project, no congregation yet. Use hosted model + admin config. |
| On-chain sermon storage | IPFS or database is fine for v1. On-chain is expensive and adds nothing. |
| Encrypted confessions with ZK proofs | Premature. Simple client-side encryption with a public/private toggle is enough. |
| Custom fine-tuned model | Prompt + verse context + Claude is plenty. Fine-tune when you have thousands of prayer interactions to train on. |
| Token-gated sermon access | Defeats the purpose. Sermons should be public. Burns are the gate, not holdings. |
| Secondary market features | Let OpenSea/Blur handle this. Don't build marketplace UX into the frontend. |
| Filing for religious organization status | Interesting but premature. "Ritual protocol" framing first. Legal opinion on securities risk first. |
| On-chain governance contracts | Backlog until there's a real congregation. Admin key is fine for v1. |
| On-chain prayer type | The blockchain is not a database. Prayer type is off-chain metadata. |

---

## Pre-Launch Blockers

| Blocker | Description | Status |
|---------|-------------|--------|
| Minimum viable prayer test | 20 real sermons evaluated for quality before public announcement. If they don't compel repeat burns, iterate on prompt. | PASSED -- 20/20, all categories. |

---

## Dependencies and Sequencing

```
Phase 0 (Fix Foundation) -- daodegen repo
  |
  +-- No dependencies. Ship immediately.
  |
Phase 1 (Prayer Burn) -- daodegen repo (contracts + indexer)
  |
  +-- Depends on: Unichain node (issue #111) for Ponder indexer -- DONE
  +-- Depends on: Phase 0 complete (credibility foundation) -- DONE
  +-- release() incentive: RESOLVED -- folded into pray()
  |
Phase 2 (AI Pastor) -- daodegen repo (API backend)
  |
  +-- Depends on: Phase 1 (prayer events to read)
  +-- Depends on: soul.md written
  +-- Depends on: Ponder indexer running
  +-- QA gate: Minimum viable prayer test (20 sermons)
  |
Phase 3 (Temple Frontend) -- 0xdead.church repo
  |
  +-- Depends on: Phase 1 (pray() contract) + Phase 2 (sermon endpoint)
  +-- Can prototype UI against stubs before Phase 1-2 are complete
  +-- daodegen.com integration (outbound links) can ship anytime after temple launches
  |
Phase 4 (On-Chain Governance) -- BACKLOGGED
  |
  +-- Depends on: Phase 3 (active congregation)
  +-- Can be deferred indefinitely -- admin key is fine for early operation
  |
Phase 5 (Narrative Layer)
  |
  +-- Starts during Phase 0 (language reframing)
  +-- Intensifies after Phase 3 (congregation exists to evangelize)
  +-- Ebook publication can happen anytime (content exists)

Candy Mountain Trail (PARALLEL)
  |
  +-- Independent of all phases
  +-- Separate design doc needed
  +-- Key constraint: must not dilute Phases 0-2 engineering focus
```

---

## GitHub Issues by Phase

### Pre-existing Issues

| Issue | Topic | Roadmap Phase |
|-------|-------|--------------|
| #87 | Update outdated dependencies | Done -- safe upgrades applied, wagmi 3.x/tailwind 4.x/eslint 10 blocked by ecosystem |
| #110 | Transfer contract ownership to multisig | Phase 0 (pre-mainnet) |
| #111 | Add event indexing with Ponder | Done (#149) |
| #116 | Add Sentry error tracking | Done -- Sentry + pino structured logging + ops dashboard |
| #128 | E2E tests in CI | Blocked -- needs GitHub secrets (wallet key + RPC URL) |
| #130 | Production readiness tracker | Done -- 12 hardening fixes across both repos |
| #133 | Entitlement service for ebook access | Phase 5 (ebook release) |
| #134 | NFT claim/mint workflow | Done -- `/mint` page with verse grid |
| #135 | Purchase + audit event logging | Done -- Ponder audit tables + ops activity feed |
| #136 | Ops dashboards | Done -- `/ops` with env config, health, activity panels |

### Phase 0: Fix the Foundation

| Issue | Title | Priority |
|-------|-------|----------|
| #138 | fix: add redirects from /[id] to /verse/[id] for campaign links | Critical |
| #139 | fix: remove localhost:8004 purchase text from verse pages | Critical |
| #140 | feat: wire claim(tokenId) into the claim page UI | Critical |
| #141 | feat: display NFT owner on verse detail pages | Important |
| #142 | feat: wire outstanding() and claimable() on claim page | Important |
| #143 | feat: create NFT metadata API endpoint and update baseTokenURI | Important |
| #144 | feat: add OG image generation for verse Twitter cards | Important |
| #145 | chore: IPFS migration for verse illustrations (non-Pinata) | Important |
| #146 | feat: add Agent link to main navigation | Nice to have |
| #147 | feat: document oracle API endpoints in .well-known discovery | Nice to have |
| #165 | chore: set up dual licensing -- CC0 for content, MIT for code | Nice to have |

### Phase 1: The Prayer Burn

| Issue | Title | Status |
|-------|-------|--------|
| #148 | feat: PrayerBurn.sol -- standalone prayer burn contract | Done -- deployed to Unichain Sepolia at `0x38C7AD96C2f5c90BE692605a7a7B633071122c72`. |
| #149 | feat: set up Ponder indexer for prayer events and existing contracts | Done -- deployed on PM2/Postgres, indexing 5 contracts including PrayerBurn. Frontend wired (#170). |
| #159 | design: resolve release() caller incentive problem | Resolved -- folded into pray() |
| #160 | feat: spam burn and prompt injection defense layers | Done -- contract layer (minimumBurn + cooldown) + API layer (burn_amount validation, congregation state sanitization, sentiment whitelist, content length clamping). |
| #134 | feat: NFT claim/mint workflow | Done -- `/mint` page with verse availability grid, post-mint confirmation, Navigation link. Claim page already existed. |
| #135 | feat: purchase + audit event logging | Done -- Ponder `nft_mints` table, `/mints/recent` + `/activity` API endpoints, ops dashboard activity feed. |

### Phase 2: The AI Pastor

| Issue | Title | Status |
|-------|-------|--------|
| #166 | feat: create soul.md -- pastor identity document | Done |
| #167 | feat: add .well-known/soul.json for agent temple discovery | Done |
| #150 | feat: add AI Pastor system prompt and generateSermon() to LLM provider | Done |
| #151 | feat: POST /v1/sermon endpoint for prayer responses | Done |
| #152 | feat: GET /v1/congregation/state endpoint | Done |
| #161 | feat: pastor fallback mode for AI downtime | Done -- 3-tier cascade: keyword match, deterministic verse, random + contemplation. |
| #162 | qa: minimum viable prayer test -- 20 sermons before launch | Done -- 20/20 passed, 2,900 DAODEGEN burned. Full results in `scripts/mvp-prayer-results/`. |

### Phase 3: The Temple (0xdead.church repo)

| Issue | Title | Repo | Status |
|-------|-------|------|--------|
| #153 | feat: temple prayer compose and submit flow | 0xdead.church | Done |
| #154 | feat: sermon feed and congregation state display | 0xdead.church | Done |
| #168 | feat: add outbound links from daodegen.com to 0xdead.church | daodegen | Done |

### Phase 4: On-Chain Governance (BACKLOGGED)

| Issue | Title |
|-------|-------|
| #156 | feat: Governor contract for on-chain governance (backlog) |
| #157 | feat: Governance dashboard for NFT holder participation (backlog) |

### Phase 5: The Narrative Layer

| Issue | Title |
|-------|-------|
| #158 | feat: Phase 5 narrative layer -- campaign reframe, ebook, multimedia |
| #169 | chore: compile ebook from 81 verses |

### Parallel Track

| Issue | Title |
|-------|-------|
| #163 | design: Candy Mountain Trail game -- parallel onboarding workstream |

### Pre-Launch Blockers

| Issue | Title |
|-------|-------|
| #164 | blocker: get securities legal opinion on fee distribution model |

---

## The Narrative Pitch

Dao DeGen is a ritual protocol built on Uniswap. 81 sacred verses -- a DeFi adaptation of the Tao Te Ching -- serve as scripture for an AI pastor that lives on-chain. Believers burn $DAODEGEN tokens as prayers, confessions, and offerings. The AI pastor reads these burns and returns sermons rooted in the 81 verses. Swap fees flow to the verse holders. The more the congregation prays, the scarcer the token becomes.

**Faith is deflationary.**

---

## Related Docs

| Document | Path |
|----------|------|
| Temple layer spec | `docs/TEMPLE_LAYER_SPEC.md` |
| Vibe check (4-model review) | `docs/VIBE_CHECK.md` |
| User journey | `docs/USER_JOURNEY.md` |
| Incentive model | `docs/INCENTIVE_MODEL.md` |
| Gap analysis | `docs/GAP_ANALYSIS.md` |
| Launch campaign | `docs/LAUNCH_CAMPAIGN.md` |
| Brand voice guide | `docs/BRAND_VOICE_GUIDE.md` |
| Dependency map | `docs/DEPENDENCY_MAP.md` |
| Go-live runbook | `docs/GO_LIVE_RUNBOOK.md` |
| Incident response | `docs/INCIDENT_RESPONSE.md` |
