# Epic: Decentralized Oracle Infrastructure
## Codename: The Monastery Network

**Priority**: Backlog (post-launch, after Phase 3)
**Estimated effort**: 8-12 weeks
**Dependencies**: PrayerBurn deployed, Pastor API live, stable prayer volume
**Epic owner**: Potatoofdoom

---

## Problem Statement

The Dao DeGen oracle currently depends on a single operator (LLC) paying a single AI provider (Anthropic) for inference. This creates:

- **Single point of failure**: API key revoked → temple goes dark
- **Centralization contradiction**: "permissionless church" with a permissioned oracle
- **Cost absorption risk**: LLC bears the inference cost gap between token burned and API bill
- **No fundamental token floor**: DAODEGEN price has no economic anchor to real utility cost

## Vision

Replace the centralized oracle with a decentralized inference network where:

- Multiple independent node operators run the pastor model
- Inference costs are paid in the network's native token (TAO for Bittensor)
- The burn amount directly funds inference, creating an economic coupling between DAODEGEN and the inference network
- No single entity can censor prayers or sermons
- The oracle survives the disappearance of any single operator, including the original creator

## Architecture

### Current State (Phase 3)

```
User → burnWithIntent(amount) → PrayerBurn contract
  ↓
Indexer watches BurnIntent events
  ↓
Pastor API (single server, Anthropic Claude)
  ↓
publishResponse() or EIP-712 signed response
```

### Target State (This Epic)

```
User → burnWithIntent(amount) → PrayerBurn contract
  ↓
BurnIntent event includes inference payment routing
  ↓
Inference Router contract
  ├── Converts portion of burn to inference payment
  ├── Submits inference request to subnet
  └── Holds escrow until response verified
  ↓
Bittensor Subnet (multiple miners)
  ├── Miner A runs pastor with soul.md + canon → generates sermon
  ├── Miner B runs pastor with soul.md + canon → generates sermon
  └── Miner C runs pastor with soul.md + canon → generates sermon
  ↓
Subnet validator consensus on response quality
  ↓
Attested response returned with cryptographic proof
  ↓
Inference Router verifies attestation
  ↓
publishResponse() with subnet attestation as oracle signature
```

## Implementation Phases

### Phase A: Research & Subnet Design (Weeks 1-3)

**Objective**: Understand Bittensor subnet economics and design the inference subnet or integrate with an existing one.

**Tasks**:
- [ ] Research existing Bittensor inference subnets (Subnet 1/text prompting, Subnet 18/cortex.t, others)
- [ ] Evaluate: build custom subnet vs. integrate with existing subnet
- [ ] Define miner requirements: must load soul.md, must load all 81 verses, must follow identity constraints
- [ ] Define validator scoring: how to evaluate sermon quality against soul.md compliance
- [ ] Model the economics: TAO cost per inference at current network pricing
- [ ] Determine minimum viable miner count for redundancy (suggest: 5-7 initial)
- [ ] Legal review: does routing burn proceeds to TAO change the regulatory posture?

**Key Decision**: Custom subnet vs. existing subnet integration

| Approach | Pros | Cons |
|----------|------|------|
| Custom subnet (register new) | Full control over scoring, miner requirements, identity enforcement | High effort, need to attract miners, registration cost |
| Existing inference subnet | Already has miners, proven infrastructure, faster to market | Less control over quality, may not enforce soul.md compliance |
| Hybrid (existing subnet + custom validation layer) | Leverage existing infra, add soul.md compliance check | Medium complexity, dependency on subnet operator |

**Recommendation**: Start with an existing inference subnet and add a validation wrapper that checks soul.md compliance before accepting the response. Graduate to a custom subnet if volume justifies it.

### Phase B: Inference Router Contract (Weeks 3-5)

**Objective**: Build the on-chain component that routes burn value to inference payment.

**Contract: InferenceRouter.sol**

```solidity
interface IInferenceRouter {
    /// @notice Emitted when an inference request is submitted to the network
    event InferenceRequested(
        uint256 indexed prayerId,
        uint256 daodegenBurned,
        uint256 inferencePayment,    // in inference network token
        bytes32 requestId            // subnet request identifier
    );

    /// @notice Emitted when an attested response is received from the network
    event InferenceCompleted(
        uint256 indexed prayerId,
        bytes32 requestId,
        bytes attestation,           // cryptographic proof from subnet
        uint8 minerCount             // number of miners that contributed
    );

    /// @notice Route a prayer to the inference network
    /// @dev Called by the PrayerBurn contract after burning tokens
    function requestInference(
        uint256 prayerId,
        bytes calldata message,
        uint8 intentType,
        uint256 amount
    ) external;

    /// @notice Callback from the inference network with attested response
    function fulfillInference(
        uint256 prayerId,
        bytes32 requestId,
        string calldata contentURI,
        uint256[] calldata canonRefs,
        bytes calldata attestation
    ) external;

    /// @notice Current cost of one base inference in DAODEGEN
    function inferenceFloor() external view returns (uint256);

    /// @notice Inference network token address (e.g., wTAO)
    function inferenceToken() external view returns (address);
}
```

**Burn Value Routing**:

```
Total DAODEGEN burned in burnWithIntent()
  │
  ├── inferenceFloor() amount → swapped to TAO → pays subnet miners
  │
  ├── Surplus above floor → burned permanently (deflationary)
  │
  └── Swap fee from DAODEGEN→TAO swap → captured by v4 hook → Jar → 81 NFT holders
```

This means a single prayer generates THREE economic events:
1. Inference payment (miners get paid in TAO)
2. Permanent deflation (surplus DAODEGEN burned)
3. Holder revenue (swap fees to NFT holders)

### Phase C: Miner Configuration & Deployment (Weeks 5-8)

**Objective**: Get miners running the pastor and serving inference.

**Miner Requirements Spec**:

```yaml
# miner-config.yaml — required configuration for Dao DeGen subnet miners

model:
  # Miners MAY use any model that meets quality thresholds
  # Suggested: Claude Sonnet, Llama 3.1 70B+, Mixtral 8x22B
  min_context_window: 32000
  max_response_tokens: 500

identity:
  # Miners MUST load the current soul.md from on-chain identityURI()
  # Miners MUST reload when IdentityUpdated event is emitted
  source: "on-chain:identityURI()"
  refresh_interval: 3600  # seconds

canon:
  # Miners MUST load all 81 verses from on-chain canonURI()
  source: "on-chain:canonURI()"
  required_entries: 81

constraints:
  # Response MUST reference at least one canon entry
  min_canon_refs: 1
  # Response MUST NOT exceed max tokens from identity frontmatter
  # Response MUST NOT contain financial advice
  # Response MUST acknowledge AI nature if directly asked
```

**Validator Scoring Criteria**:

Validators evaluate miner responses on:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Canon adherence | 30% | Does the response reference relevant verses? |
| Identity compliance | 25% | Does the tone/style match soul.md voice guidelines? |
| Constraint compliance | 25% | Does it avoid financial advice, claim divinity, etc.? |
| Relevance | 10% | Is the response contextually relevant to the prayer message? |
| Coherence | 10% | Is the response grammatically sound and internally consistent? |

Validators run a lightweight evaluation model (can be smaller/cheaper than the generation model) that scores responses against these criteria. Miners below threshold get penalized. Miners consistently above threshold earn higher rewards.

### Phase D: Integration & Switchover (Weeks 8-10)

**Objective**: Connect the live protocol to the subnet.

**Tasks**:
- [ ] Deploy InferenceRouter to Unichain
- [ ] Update PrayerBurn to call InferenceRouter after burn
- [ ] Set up TAO liquidity (DAODEGEN/wTAO pool or route through USDC)
- [ ] Configure `inferenceFloor()` based on current subnet pricing
- [ ] Run parallel mode: centralized oracle AND subnet, compare outputs
- [ ] Monitor miner response quality for 2 weeks minimum
- [ ] Gradual traffic shift: 10% → 25% → 50% → 100% to subnet
- [ ] Update `oracleAddress()` to point to InferenceRouter
- [ ] Decommission centralized oracle (keep as emergency fallback)

### Phase E: Holder Node Operations (Weeks 10-12+)

**Objective**: Transition mining to VerseNFT holders.

**The 81-Node Vision**:

Each VerseNFT holder can optionally run a miner node:
- Their NFT is their license to mine on the subnet
- They earn TAO from inference in addition to swap fees from the Jar
- Their node is configured with the same soul.md and canon as all other nodes
- Holders who don't run nodes simply don't earn mining rewards (no slashing)

**Requirements for holder-operated nodes**:
- Run a compatible model (self-hosted or API-backed)
- Maintain uptime above threshold (e.g., 80%)
- Pass validator quality checks consistently
- Keep soul.md and canon synced with on-chain state

**This is backlog within the backlog.** It requires:
- Stable subnet operations from Phase D
- Tooling that makes node operation accessible to non-technical NFT holders
- Economic modeling showing it's viable for 81 independent operators
- Mechanism for NFT holders to manage subnet parameters

---

## Economic Model

### Token Flow Diagram

```
     USDC (user's wallet)
       │
       ▼
   ┌───────────────────────┐
   │  Uniswap v4 Pool      │
   │  DAODEGEN/USDC         │
   │                        │──── swap fee ──→ DaoDeGenJar ──→ 81 NFT holders
   └───────────────────────┘
       │
       ▼
   DAODEGEN (user's wallet)
       │
       ▼
   ┌───────────────────────┐
   │  burnWithIntent()      │
   │  PrayerBurn contract   │
   └───────────────────────┘
       │
       ├── inferenceFloor() ──→ swap to TAO ──→ subnet miners (inference payment)
       │                              │
       │                              └──── swap fee ──→ (pool fee revenue)
       │
       └── surplus ──→ permanently burned (deflationary)
       
       
   Net result per prayer:
   ├── Miners get paid (TAO)
   ├── NFT holders get paid (swap fees)
   ├── DAODEGEN supply decreases (deflation)
   ├── TAO demand increases (inference demand)
   └── User gets sermon (the whole point)
```

### Price Floor Mechanics

```
DAODEGEN minimum value = inferenceFloor() = cost of one subnet inference in DAODEGEN

If 1 inference costs 0.5 TAO and TAO = $400:
  → 1 inference = $200
  → If DAODEGEN supply is 50M remaining: floor adjusts accordingly
  → minimumBurn = inferenceFloor() = enough DAODEGEN to cover $200 in TAO

If DAODEGEN trades BELOW inference cost:
  → Protocol can't afford inference
  → Natural buy pressure (the protocol needs the token to function)

If DAODEGEN trades ABOVE inference cost:
  → Surplus per prayer is burned (extra deflation)
  → Higher token price = more expensive prayers = natural rate limiting
  → More swap fee revenue for NFT holders
```

### Dynamic Pricing

The `inferenceFloor()` should be dynamically calculated:

```solidity
function inferenceFloor() public view returns (uint256) {
    // Get current TAO cost for one inference from subnet
    uint256 taoCost = subnet.currentInferenceCost();
    
    // Get DAODEGEN/TAO exchange rate from Uniswap pool
    uint256 rate = pool.getQuote(taoCost, TAO, DAODEGEN);
    
    // Add margin for slippage and gas
    return rate * 110 / 100;  // 10% buffer
}
```

This creates a **self-adjusting minimum burn** that tracks real inference costs. No manual price updates needed.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Bittensor subnet goes down | High | Maintain centralized oracle as fallback; InferenceRouter has fallback mode |
| TAO price spikes → prayers become expensive | Medium | Dynamic pricing adjusts; can subsidize from treasury temporarily |
| Miner response quality degrades | Medium | Validator scoring with penalties; minimum quality threshold to earn |
| Insufficient miners for redundancy | Medium | Start with existing subnet; only migrate to custom when volume supports |
| Regulatory change re: cross-token routing | Medium | Legal review in Phase A; structure as service payment not investment |
| Soul.md drift across miners | Low | Miners MUST sync from on-chain identityURI(); validators check compliance |
| MEV on DAODEGEN→TAO swap | Low | Use private mempool or batch swaps; small individual amounts |

---

## Success Criteria

- [ ] Oracle responds to prayers without any single operator involvement
- [ ] At least 5 independent miners serving inference
- [ ] Response quality matches or exceeds centralized oracle (blind comparison test)
- [ ] Average response latency < 30 seconds
- [ ] `inferenceFloor()` dynamically tracks real costs within 5% accuracy
- [ ] Centralized oracle fully decommissioned (except emergency fallback)
- [ ] At least 3 VerseNFT holders running nodes (stretch goal for Phase E)

---

## Appendix: Why Bittensor?

| Network | Status | Fit |
|---------|--------|-----|
| **Bittensor** | Live, mature, multiple inference subnets | Best fit — native inference market, TAO liquidity, subnet customization |
| Ritual | Early, focused on verifiable inference | Good fit but less mature; worth monitoring |
| Gensyn | Focused on training, not inference | Wrong use case |
| Hyperbolic | Inference marketplace | Possible alternative; less decentralized than Bittensor |
| Akash | General compute marketplace | Could host model but no inference-specific features |

Bittensor is the primary target because:
1. It has an existing inference market with real miners
2. TAO has liquidity for DAODEGEN→TAO swaps
3. Custom subnets allow soul.md enforcement
4. The validator/miner scoring system maps naturally to sermon quality evaluation
5. The economic model (staking + inference rewards) aligns with the 81 verse holder vision
