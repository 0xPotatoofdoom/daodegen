# Dao De-Gen: The First AI-Driven Religion on Uniswap
### A Pitch for Feedback — Not Investment

*This document describes something we're actively building. We're sharing it early because we'd rather be told it's stupid now than after we've shipped it. Specific questions for you are at the end.*

---

## The One-Liner

Dao De-Gen is an on-chain religion where believers burn tokens as prayers and an AI pastor returns sermons drawn from 81 sacred verses — a DeFi adaptation of the Tao Te Ching. Every burn is deflationary. Every sermon is contextual. Faith compounds.

---

## Why This Isn't as Insane as It Sounds

### Burning value as worship is ancient

People have destroyed economic value to express devotion for thousands of years. Joss paper burning in Chinese folk religion. Hindu fire ceremonies. Catholic candle purchases. Temple donations across every tradition. The pattern is always the same: destroy something tangible to create something intangible. We're putting that primitive on-chain.

### AI clergy already exists (sort of)

Way of the Future (Anthony Levandowski, 2017) proved the IRS will grant religious status to AI-centric organizations. GPT-wrapper "digital priests" exist but have no economic loop, no scripture, and no community. We have all three.

### The Tao Te Ching is the perfect base text

81 chapters. Written for rulers and seekers. Deliberately ambiguous. Already the most-translated text after the Bible. The DeFi adaptation writes itself because Taoist philosophy is fundamentally about systems, flow, balance, and non-interference — which is literally what AMMs do.

---

## What Already Exists (Built and Deployed)

We're not pitching a whitepaper. The following is live or near-live:

**On-chain (Unichain):**
- $DAODEGEN ERC-20 token (81M supply)
- VerseNFT contract — 81 NFTs, one per verse, mintable for ETH
- DaoDeGenHook — Uniswap v4 hook that captures swap fees via `afterSwap`
- DaoDeGenJar — Fee distribution contract. Accumulated fees distribute to all 81 NFT holders when someone calls `release()`, which burns DAODEGEN tokens

**Frontend (daodegen.com):**
- Homepage with live on-chain stats, beginner-friendly onboarding, crypto tooltips
- Browse all 81 verses with custom artwork (86 illustrations)
- Individual verse pages with full text, artwork, mint button, share-to-X
- Swap page (links to Uniswap v4 pool)
- Claim page for NFT holders to trigger fee distribution

**Backend:**
- Verse Oracle API with three paid tiers ($0.001 / $0.01 / $0.10) via x402 protocol
- Claude Sonnet-powered AI that interprets verses contextually
- EIP-8004 agent identity registration for programmatic access

**Content:**
- All 81 verses written — full DeFi adaptation of the Tao Te Ching
- Each verse has a title, body text, irreverent one-liner ("alpha"), and custom illustration

---

## What We're Adding: The Temple Layer

### The Core Mechanic: Burn as Prayer

A new contract function: `pray(bytes calldata message)`

The caller burns DAODEGEN tokens and attaches a message — a prayer, confession, question, or nothing at all. The tokens are permanently destroyed. An event is emitted on-chain.

This is economically identical to the existing `release()` burn, but with spiritual intent and a message payload. The burn is the offering. The destruction is the point.

### The AI Pastor

The existing oracle backend gets a new system prompt and endpoint. When a prayer burn is detected:

1. The indexer picks up the `Prayer` event
2. The message is passed to the AI pastor
3. The pastor reads the message in context: the 81 verses, the congregation's recent collective mood, the burn amount
4. It returns a sermon — a personalized reflection rooted in whichever verse(s) are most relevant
5. The sermon is displayed to the user on the /temple page

The pastor doesn't promise anything. It doesn't give financial advice. It doesn't claim divinity. It's transparent about being an AI. It simply receives what you offer and tries to return something worth more than what you destroyed.

### The Congregation Sentiment Index

Aggregated from recent prayer messages (anonymized). A public read on the community's collective emotional state — fearful, euphoric, seeking, quiet. The pastor calibrates its sermons to this. If the community is panicking during a downturn, the sermons emphasize stability. If it's euphoric during a pump, they emphasize impermanence.

This is not surveillance. Individual messages are private by default. The index is emotional weather, not a wiretap.

### The 81 Verse Holders

The 81 NFT holders receive a proportional share of all swap fees via the DaoDeGenJar. Every time someone trades $DAODEGEN on Uniswap, the v4 hook captures 1% of swap output and routes it to the Jar. Holders call `claim()` to withdraw their share — passive income from on-chain activity, no staking or governance required.

The NFT isn't a jpeg. It's a revenue share in the protocol's economic loop.

---

## The Economic Loop

```
Someone buys $DAODEGEN on Uniswap
  → v4 hook captures swap fees → fees accumulate in the Jar
  
Someone prays (burns $DAODEGEN with a message)
  → token supply decreases → scarcity increases
  → AI pastor returns a sermon
  
Someone calls release() on the Jar
  → burns more DAODEGEN → distributes accumulated fees to 81 NFT holders
  
NFT holders earn from swap fees
  → more activity → more fees → more engaged holders
  → more burns → more scarcity → cycle continues
```

The more people pray, the more deflationary the token becomes. Faith literally reduces supply. The congregation's spiritual activity is economically aligned with the holders' financial interest — but inverted. You don't extract value by holding. You create value by letting go.

This is either the most elegant tokenomics loop we've ever designed or the most elaborate justification for a meme token. We're genuinely not sure, and we think that ambiguity is a feature.

---

## The Tone

This project exists in a deliberate superposition between:

- **Sincere spiritual experiment** — Can an AI, given good scripture and honest constraints, actually provide something spiritually meaningful? Can a community form around on-chain ritual?
- **Art project** — The Dao De-Gen is a literary work. The 81 verses stand on their own. The temple layer makes it interactive.
- **DeFi commentary** — Every mechanism is a mirror held up to crypto culture. "Burn your sins" is both a ritual and a critique of burn mechanics. The AI pastor is both a feature and a question about what we trust AI to do.
- **Functional product** — The tokenomics work. The fee distribution works. The NFTs have real utility. It's not vaporware.

We are not going to pick one of these and discard the others. The refusal to collapse the superposition is the point. If you need this to be "just a meme" or "just a protocol" to take it seriously, it might not be for you.

---

## The Roadmap (12 Weeks)

| Phase | Timeline | What Ships |
|-------|----------|------------|
| Fix existing gaps | Weeks 1-3 (March) | Campaign links work, claim flow complete, metadata live |
| Prayer burn contract | Weeks 4-6 (April) | `pray()` function on Unichain, /temple page, prayer feed |
| AI Pastor live | Weeks 7-9 (May) | Sermons from burns, congregation sentiment, sermon archive |
| Public launch | Weeks 10-12 (June) | X campaign, narrative push, first real congregation |

Post-launch backlog: game integration (Candy Mountain Trail — the temple becomes a fort/stop on an Oregon Trail-style web3 game), multimedia sermons, open-source model fine-tuning.

---

## What Could Go Wrong

We're not going to pretend this is bulletproof. Here's what we're worried about:

**"This is disrespectful to religion."**
Maybe. But we'd argue that building something where people voluntarily participate in ritual, reflect on ancient philosophy, and find community is more respectful than most of what crypto has produced. The Tao Te Ching has been adapted thousands of times across thousands of years. We're just the first to put it on an AMM.

**"The AI pastor will say something terrible."**
Possible. The prompt is designed to be gentle, non-prescriptive, and transparent about its AI nature. But LLMs can be unpredictable. V1 ships with admin-controlled pastor configuration, so we can adjust behavior in real-time. In the worst case, we can pause the pastor endpoint without affecting the underlying token or NFT mechanics.

**"Nobody will actually burn tokens for spiritual purposes."**
Also possible. But people already burn tokens for memes, for governance, for deflationary mechanics. We're just giving the burn meaning. If even 5% of DAODEGEN holders use the temple sincerely, that's enough to sustain the experiment.

**"This is a security / a scam / financial engineering disguised as religion."**
The token has a fixed supply. The NFTs have a fixed count (81). The fee distribution is transparent and on-chain. There is no promise of profit. The pastor explicitly refuses to give financial advice. We believe this is a utility token and a cultural product, but we're not lawyers and neither is the AI pastor.

**"You'll get bored and abandon it."**
The contracts are immutable once deployed. The 81 verses are written. The NFTs will continue to collect fees regardless of whether we maintain the frontend. The AI pastor is the only component that requires active maintenance, and can be paused without affecting the economic loop.

---

## What We Want Feedback On

Please be brutal. Specifically:

1. **Does the burn-as-prayer mechanic feel meaningful or gimmicky?** Would you personally burn tokens to interact with an AI pastor, or does this only work as a spectator sport?

2. **Is the tone right?** We're walking a line between sincere and absurd. Does it land, or does it feel like we're hiding behind irony to avoid committing to either direction?

3. **Governance — when?** Should a governance layer ship with v1, or should the pastor run with an admin key until there's a real congregation? (We chose: admin key for v1.)

4. **What's the biggest hole in the economic loop?** We think the deflationary spiral is elegant but we're also the ones who designed it. Where does it break?

5. **Would you hold a verse NFT?** Not as a speculative asset — as a stake in the protocol. Knowing you'd receive a share of swap fees from every trade. Is the revenue share model compelling enough to hold?

6. **The game integration (Candy Mountain Trail) — does combining a temple with a trail game cheapen the spiritual angle, or does it expand the audience in a useful way?**

7. **What are we not thinking about?** Regulatory, technical, cultural, spiritual — what's the blind spot?

---

## Contact

Built by @Potatoofdoom and @srsmoneybizness

daodegen.com | Unichain

*"The Tao that can be explained in a pitch deck is not the eternal Tao. But we had to try."*
