# Dao DeGen User Journey

How users discover, experience, and participate in Dao DeGen -- from first X campaign click to active congregation member.

Last updated: 2026-02-21

---

## Audiences

| Segment | Entry Point | Goal | Converts To |
|---------|------------|------|-------------|
| **CT philosophers** | X campaign verse post | Read the verses, appreciate the parody | NFT collector, fee earner |
| **Protocol builders** | X campaign, word of mouth | Brand-safe culture asset to reference | NFT collector, API consumer |
| **Collectors of narrative NFTs** | X campaign, secondary markets | Own verses, earn from trading fees | Fee earner, congregation |
| **AI agents** | `.well-known/agent-registration.json` | Programmatic access to verse oracle | Paying API consumer |
| **Congregation** (future, Phase 3+) | Temple page, X campaign | Burn tokens as prayers, receive sermons | Recurring burner, evangelist |

---

## Stage 1: Discovery (X Campaign)

**Trigger:** User sees a verse post from @Potatoofdoom or @srsmoneybizness on X.

**Post format** (from `docs/LAUNCH_CAMPAIGN.md`):
```
[IMAGE: 1200x675 verse card]

"[Verse text, 1-3 lines]"

-- Dao DeGen, Verse [N]/81

[Caption: irreverent commentary connecting verse to DeFi]

daodegen.com/verse/[N]
```

**What must work:**
- The link `daodegen.com/verse/[N]` must resolve -- DONE (redirects from `/[N]` to `/verse/[N]` in next.config.js)
- The Twitter card must render a properly sized OG image -- DONE (1200x675 via opengraph-image.tsx)
- The OG metadata must include title, description, and verse-specific image -- DONE

---

## Stage 2: Landing Page

**URL:** `daodegen.com/` or `daodegen.com/verse/[N]`

### Path A: Homepage (daodegen.com/)

First-time visitors see, in order:

1. **BeginnerBanner** (1s delay, dismissible via localStorage) -- plain-English explanation: "like a digital book where you can own individual chapters"
2. **Hero** -- "81 Verses of Digital Age Wisdom / The first book where readers become stakeholders"
3. **CryptoTooltips** on key terms (NFTs, Token Trading, Uniswap V4) for non-crypto visitors
4. **Three CTAs:** Read Free (`/verses`), Collect Verses (`/swap`), How It Works (scroll)
5. **Live stats** from on-chain reads: NFTs Minted (X/81), Fees in Jar (ETH), Token Supply, Verses (81)
6. **Contract addresses** (collapsible, links to Uniscan)
7. **Featured Verse #1** with artwork and first 4 lines
8. **HowItWorks** -- 4 steps (Read, Collect, Earn, Automation) with Simple/Detailed toggle
9. **Value propositions** -- Read First (free), Automated (smart contracts), First Ever
10. **BeginnerFAQ** -- 8 questions across 3 categories

**Design intent:** Dual-audience landing. Crypto-native users skip the tooltips and banner. Non-crypto newcomers get progressive disclosure at every level.

### Path B: Direct Verse Link (daodegen.com/verse/[N])

User lands directly on a verse detail page (the more likely path from X campaigns). See Stage 4 below.

---

## Stage 3: Browse Verses

**URL:** `/verses`

**Experience:**
- Searchable, sortable grid of all 81 verses
- Each card: artwork (lazy-loaded), title, first 2 lines, verse number, "NFT Available" badge
- Search filters by title and body text
- Sort by number or alphabetical title

**No wallet required.** Content is free to browse. This is the "read before you invest" step that the FAQ and value propositions promise.

**User action:** Click a verse card to read the full text.

---

## Stage 4: Read a Verse

**URL:** `/verse/[id]` (statically generated for all 81)

**Experience:**
- Full illustration (priority-loaded)
- Complete verse body in serif font, preserving poetic line breaks
- "Alpha" -- the irreverent one-liner DeFi interpretation
- NFT Information panel: Token ID, fee share (1/81), owner
- **VerseMintButton** -- connect wallet, see price, mint
- Social sharing: Tweet intent (pre-formatted), copyable URL
- Previous/Next navigation through all 81

**The conversion point:** This is where a reader decides to become a collector. The VerseMintButton reads `mintPrice()` and `totalSupply()` from the VerseNFT contract, shows the cost, and calls `mint()` on click.

**SEO:** Each verse page has unique `<title>`, `<meta description>`, and OG tags with the verse title, alpha text, and illustration.

**Previously identified gaps -- all resolved:**
- ~~Owner field hardcoded to "Not yet minted"~~ -- now reads `ownerOf()` via VerseOwner component
- ~~Text below the mint button references "localhost:8004"~~ -- removed
- ~~OG images are square illustrations~~ -- 1200x675 Twitter cards via opengraph-image.tsx

---

## Stage 5: Connect Wallet

**Trigger:** User clicks VerseMintButton, ConnectButton, or any wallet-gated action.

**Experience:**
- RainbowKit modal opens
- Supports MetaMask, WalletConnect, Coinbase Wallet, and others
- Configured for Unichain (chain ID 130) as primary, plus Ethereum, Base, Arbitrum, Polygon
- RPC: private Alchemy endpoint via `NEXT_PUBLIC_UNICHAIN_RPC`, fallback to `mainnet.unichain.org`

**What must work:**
- WalletConnect project ID must be real (currently has "demo-project-id" fallback)
- User must be on Unichain (chain ID 130) for contract interactions

---

## Stage 6: Collect (Mint or Buy)

### Path A: Mint a Verse NFT

**Where:** VerseMintButton on `/verse/[id]`

**Flow:**
1. Button shows current mint price (from `mintPrice()`) and supply (X/81 minted)
2. User clicks "Mint a Verse NFT (X ETH)"
3. Wallet prompts for confirmation
4. Transaction states: pending --> confirming --> confirmed / error
5. If supply reaches 81, button shows "Sold Out (81/81)"

**Important:** `mint()` mints the next sequential token ID, not a specific verse. The button text says "Mint a Verse NFT", not "Mint This Verse."

### Path B: Buy $DAODEGEN Token

**Where:** `/swap`

**Flow:**
1. Page checks wallet connection and chain (must be Unichain, ID 130)
2. Shows wallet info: connected chain, ETH balance
3. Single CTA: "Trade on Uniswap" -- external link to `app.uniswap.org` pre-configured with `outputCurrency=DAODEGEN_TOKEN_ADDRESS` and `chain=unichain`
4. Token info panel: contract address, supply (81M), standard (ERC-20)
5. Revenue sharing explainer

**The user leaves the site** to complete the swap on Uniswap. When the swap executes, `DaoDeGenHook.afterSwap()` automatically captures 1% of swap output and forwards it to the Jar.

---

## Stage 7: Earn (Fee Accumulation)

**Passive.** No user action required.

Every $DAODEGEN swap on the Uniswap V4 pool triggers:
```
Swap --> PoolManager --> DaoDeGenHook.afterSwap() --> takes 1% fee --> sends to DaoDeGenJar
```

Fees accumulate in the Jar's balance until someone triggers `release()`.

---

## Stage 8: Claim Fees

**URL:** `/claim`

**Flow:**
1. Connect wallet
2. See NFT balance ("You hold X Verse NFTs")
3. See Jar balance (accumulated fees)
4. **Release step:** Anyone can trigger fee distribution by burning $DAODEGEN tokens
   - Reads `burnAmount()` from Jar
   - Checks user's DAODEGEN balance and allowance
   - If allowance insufficient: Approve step first
   - Calls `release([address(0)])` to distribute ETH fees to all 81 token IDs
5. **Claim step** (not yet in UI): Individual holders call `claim(tokenId, assets)` to withdraw their share

**Previously identified gaps -- partially resolved:**
- ~~No `claim(tokenId)` UI~~ -- per-NFT claim buttons with tx states now wired
- ~~Fee amounts show "---"~~ -- `outstanding()` and `claimable()` now read from chain
- No claim history or event log -- deferred to Ponder indexer (Phase 1)

**Incentive model:** See `docs/INCENTIVE_MODEL.md`. The burn cost rate-limits releases. NFT holders who also own $DAODEGEN are the most aligned callers.

---

## Stage 9: Agent API (Programmatic / AI Agents)

**URL:** `/agent` (linked from main nav -- desktop and mobile)

**Discovery:** `.well-known/agent-registration.json` returns ERC-8004 metadata with auth endpoints, all contract addresses, and verse oracle API discovery.

**Flow:**
1. Register agent identity on-chain via `AgentRegistry.register()`
2. Login with SIWE to get a JWT (24h expiry)
3. Call verse oracle endpoints with JWT + x402 USDC payment:
   - `POST /v1/verse/lookup` ($0.001) -- verse text + AI interpretation
   - `POST /v1/verse/commentary` ($0.01) -- contextual AI analysis
   - `POST /v1/verse/oracle` ($0.10) -- AI selects most relevant verse

**Backend:** Claude Sonnet 4.5 via `AnthropicLLMProvider` with oracle system prompt. Falls back to `StubLLMProvider` when no API key.

**Payment:** x402 protocol with USDC on Unichain Sepolia, settled by self-hosted facilitator at `FACILITATOR_URL`.

**Current gap:** The agent page is browser-based but x402 payment requires a programmatic HTTP client. Browser users see the 402 response but cannot complete payment.

---

## Stage 10: The Temple (Future -- Phase 3+)

**URL:** `0xdead.church` (separate repo and deployment, not a route on daodegen.com)

**Intended flow:**
1. Connect wallet
2. Compose a prayer/confession/question
3. Select prayer type: Prayer / Confession / Question / Silent / Offering (off-chain metadata)
4. Toggle public/private (private = client-side encrypted before tx)
5. Set burn amount (minimum enforced by `PrayerBurn.sol`)
6. Submit --> calls `pray(message)` --> burns DAODEGEN, emits `Prayer` event
7. Intentional UX pause -- "The pastor is reading your offering..."
8. Display sermon response with verse references linked to `daodegen.com/verse/[id]`
9. Browse public sermon archive at `/sermons`, congregation dashboard at `/congregation`

**Design:** Clean, minimal, sincere. No meme energy. Dark background, serif typography, generous whitespace. No confetti. The burn happened. The words appear. That's it.

**daodegen.com integration:** Outbound links only -- "Enter the Temple" on homepage, "Pray with this verse" on verse pages, "Temple" in nav. See #168.

**This stage depends on:** Phase 1 (PrayerBurn contract), Phase 2 (AI Pastor backend), Phase 3 (Temple frontend at 0xdead.church). See `docs/TEMPLE_LAYER_SPEC.md`.

---

## Navigation Map

```
daodegen.com/
  |
  +-- /verses ........... Browse all 81 verses (free, no wallet)
  |     |
  |     +-- /verse/[id] . Read full verse, mint NFT, share on X
  |
  +-- /swap ............. Buy $DAODEGEN via Uniswap (external link)
  |
  +-- /claim ............ Release fees + claim per NFT (NFT holders)
  |
  +-- /agent ............ EIP-8004 identity + x402 oracle (developers)
  |
  +-- /.well-known/agent-registration.json ... ERC-8004 + API discovery
  +-- /api/auth/nonce ........................ SIWE nonce generation
  +-- /api/auth/verify ....................... SIWE verification + JWT
  +-- /api/health ............................ Health check
  +-- /api/verse/[id]/metadata ............... ERC-721 NFT metadata JSON
  +-- /v1/verse/lookup ....................... Verse lookup (x402)
  +-- /v1/verse/commentary ................... Contextual commentary (x402)
  +-- /v1/verse/oracle ....................... Oracle reading (x402)
  +-- /v1/sermon ............................ Pastor sermon (future, Phase 2)
  +-- /v1/congregation/state ................ Congregation sentiment (future, Phase 2)

0xdead.church/ (separate repo, future Phase 3)
  |
  +-- / ................. Temple landing: prayer input, sermon display
  +-- /sermons .......... Sermon archive (filterable)
  +-- /congregation ..... Congregation dashboard + sentiment
```

---

## Key Data Sources

| Data | Source | Location |
|------|--------|----------|
| 81 verses (text, title, alpha) | Static JSON | `src/data/verses.json` |
| 81 illustrations | Static PNGs (86 files) | `public/illustrations/` |
| Contract addresses | Env vars with Sepolia defaults | `src/lib/contracts.ts` |
| Token stats (NFT supply, jar balance, token supply) | On-chain reads via wagmi | `src/hooks/useTokenStats.ts` |
| AI interpretations | Claude Sonnet 4.5 (realtime) | `src/lib/llm.ts` |
| Auth state | SIWE + JWT (in-memory nonce store) | `src/lib/auth.ts` |
| Payment settlement | x402 facilitator (USDC on Unichain Sepolia) | `src/lib/x402.ts` |

---

## Related Docs

| Document | Path |
|----------|------|
| Roadmap | `docs/ROADMAP.md` |
| Temple layer spec | `docs/TEMPLE_LAYER_SPEC.md` |
| Vibe check | `docs/VIBE_CHECK.md` |
| Incentive model | `docs/INCENTIVE_MODEL.md` |
| Gap analysis | `docs/GAP_ANALYSIS.md` |
| Launch campaign | `docs/LAUNCH_CAMPAIGN.md` |
| Brand voice guide | `docs/BRAND_VOICE_GUIDE.md` |
| Dependency map | `docs/DEPENDENCY_MAP.md` |
