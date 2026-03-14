# Incident Response Plan -- Dao DeGen

> Tracks GitHub issue #126. Defines severity levels, pause procedures, decision matrix, communication protocols, recovery steps, and key-holder responsibilities.

**Last updated:** 2026-03-14
**Networks:** Unichain Mainnet (chain ID 130) + Unichain Sepolia (chain ID 1301)
**RPC:** `https://mainnet.unichain.org` (public) or Alchemy private endpoint
**Contracts in scope:**

| Contract | Mainnet Address | Sepolia Address | Pausable? |
|---|---|---|---|
| DaoDeGenToken | `0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947` | `0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16` | **No** |
| VerseNFT | `0xA5290EEfEEd1dCBE8e8f12D9584Bc7bd14f948A1` | `0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50` | Yes (OZ `Pausable`) |
| DaoDeGenJar | `0x78D404fAaED5Ff2db7dC960A8F0798589bB6cd9b` | `0xd25a5C67F180811e43990B2A0148Ac0d93ab9336` | Yes (OZ `Pausable`) |
| DaoDeGenHook | `0x000FCDfd31d4a78b261A5256A1fD1EDbbc009937` | _same_ | Yes (custom `paused` bool) |
| AgentRegistry | `0x8105821036A5AD70B1291787C2Eabf455038eE20` | `0xBFE569F809b644703175Be603684Be0b7f6eee89` | Yes (OZ `Pausable`) |
| PrayerBurn | _not yet deployed_ | `0x22A0EDaBF0a567C8eE646472607c25c9021920D6` | No |
| SermonCommitment | _not yet deployed_ | `0xF38a1c25079762977F42fD8C5B23C32B4Bc2551D` | No |
| AnonymousPrayer | _not yet deployed_ | `0x31C01646f56fEF263ebcbaceb605f6cF5FFec991` | No |

---

## 1. Severity Levels

### P0 -- Critical (Funds at Risk)

- Active exploit draining funds from the Jar or Hook
- Unauthorized minting, burning, or transfer of tokens/NFTs
- Reentrancy attack in progress
- Private key compromise of the deployer/owner EOA
- **Response time:** Immediate. Pause all affected contracts within minutes.

### P1 -- High (Service Degraded, Potential Fund Risk)

- Hook fee calculation producing incorrect amounts
- Jar distribution logic allocating wrong proportions
- Unexpected revert on claim/release that blocks all users
- Agent registry allowing unauthorized registration
- **Response time:** Within 1 hour. Investigate and pause if escalation to P0 is likely.

### P2 -- Medium (Non-Critical Functional Issue)

- Frontend unable to read on-chain state (RPC issues)
- Metadata URI returning incorrect content
- Gas costs significantly higher than benchmarked
- Individual claim failing for a specific token ID (not systemic)
- **Response time:** Within 24 hours. Investigate root cause; pausing not typically required.

### P3 -- Low (Cosmetic / Informational)

- Token URI formatting issues
- Event emissions with incorrect indexed fields
- Documentation out of date
- Minor frontend display bugs
- **Response time:** Next scheduled work session. Track in GitHub issues.

---

## 2. Contract Pause Procedures

Replace placeholders:
- `<OWNER_PRIVATE_KEY>` -- the private key of the contract owner/deployer
- `<RPC_URL>` -- the RPC endpoint

### 2a. DaoDeGenJar (OZ Pausable)

**Pause:** (stops `release()` and `claim()`)
```bash
cast send 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336 \
  "pause()" \
  --private-key <OWNER_PRIVATE_KEY> \
  --rpc-url <RPC_URL>
```

**Unpause:**
```bash
cast send 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336 \
  "unpause()" \
  --private-key <OWNER_PRIVATE_KEY> \
  --rpc-url <RPC_URL>
```

**Verify:**
```bash
cast call 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336 \
  "paused()(bool)" \
  --rpc-url <RPC_URL>
```

Note: Fees can still be *received* from the Hook while paused (`receive()` is not gated). `setBurnAmount()` remains callable by owner.

### 2b. DaoDeGenHook (Custom Pause)

**Pause:** (stops `afterSwap()` -- halts all swaps on the hooked pool)
```bash
cast send <HOOK_ADDRESS> \
  "setPaused(bool)" true \
  --private-key <OWNER_PRIVATE_KEY> \
  --rpc-url <RPC_URL>
```

**Unpause:**
```bash
cast send <HOOK_ADDRESS> \
  "setPaused(bool)" false \
  --private-key <OWNER_PRIVATE_KEY> \
  --rpc-url <RPC_URL>
```

Important: The Hook `owner` is `immutable` -- it cannot be transferred. If the owner key is lost, a new Hook must be deployed and the pool re-created.

### 2c. VerseNFT (OZ Pausable)

**Pause:** (stops public `mint()`)
```bash
cast send 0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50 \
  "pause()" \
  --private-key <OWNER_PRIVATE_KEY> \
  --rpc-url <RPC_URL>
```

Note: `ownerMint()` bypasses pause by design.

### 2d. AgentRegistry (OZ Pausable)

**Pause:** (stops `register()` and `update()`)
```bash
cast send 0xBFE569F809b644703175Be603684Be0b7f6eee89 \
  "pause()" \
  --private-key <OWNER_PRIVATE_KEY> \
  --rpc-url <RPC_URL>
```

Note: `revoke()` bypasses pause by design, allowing incident-time agent removal.

### 2e. DaoDeGenToken

**Not pausable.** Standard ERC-20 with no owner or pause mechanism. If the token is compromised, pause downstream consumers (Jar, Hook).

---

## 3. Decision Matrix

| Scenario | Severity | Pause Target(s) | Rationale |
|---|---|---|---|
| Jar funds being drained | P0 | **Jar** | Stops distributions and claims. ETH/tokens remain in contract. |
| Hook extracting incorrect fees | P1 | **Hook** | Stops fee collection. Also blocks swaps on hooked pool. |
| Hook sending fees to wrong address | P0 | **Hook** | Jar address is immutable, so this indicates deeper compromise. |
| Unauthorized NFT minting | P0 | **VerseNFT** | Stops public mint. Owner can still `ownerMint` to correct state. |
| Jar distributing wrong proportions | P1 | **Jar** | Existing claimable balances remain in mapping for audit. |
| Agent impersonation | P1 | **AgentRegistry** | Stops registrations. Owner can `revoke()` while paused. |
| Suspected deployer key compromise | P0 | **ALL contracts** | Pause everything. Begin key rotation. |
| RPC / frontend down | P2 | **None** | On-chain state unaffected. Fix infrastructure. |
| Token contract vulnerability (upstream OZ) | P0 | **Jar + Hook** | Token has no pause. Pause consumers. |

### Pause Order for Full Emergency (P0 Key Compromise)

1. **Jar** -- protects accumulated fees
2. **Hook** -- stops new fee collection (also halts swaps)
3. **VerseNFT** -- prevents minting
4. **AgentRegistry** -- prevents registration

---

## 4. Communication Plan

### Channels

| Channel | Handle / URL | Use For |
|---|---|---|
| Twitter/X | @srsmoneybizness | All severity levels; primary public channel |
| GitHub | repo issues | Post-mortem reports, technical details |

### Timeframes

| Severity | First Public Ack | Detailed Update | Post-Mortem |
|---|---|---|---|
| P0 | Within 30 minutes | Within 2 hours | Within 48 hours |
| P1 | Within 2 hours | Within 12 hours | Within 1 week |
| P2 | Within 24 hours | As needed | In next changelog |
| P3 | Not required | Not required | In next changelog |

### Incident Template

```
INCIDENT NOTICE -- [SEVERITY LEVEL]

Status: [Investigating / Identified / Mitigating / Resolved]
Affected: [Which contract(s) / service(s)]
Impact: [What users are experiencing]

Summary:
[1-2 sentence description]

Actions Taken:
- [List of actions]

User Action Required:
- [e.g., "Do not interact with contract X until further notice"]

Next Update: [Time]

-- Dao DeGen Team
```

---

## 5. Recovery Steps

### Pre-Unpause Checklist

1. **Root cause identified** and fully understood
2. **Fix deployed or mitigated**
3. **State audit passed:**

```bash
# Verify Jar balances match outstanding obligations
JAR=0xd25a5C67F180811e43990B2A0148Ac0d93ab9336
cast balance $JAR --rpc-url <RPC_URL>
cast call $JAR "outstanding(address)(uint256)" 0x0000000000000000000000000000000000000000 --rpc-url <RPC_URL>

# Verify NFT supply (max 81)
cast call 0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50 "totalSupply()(uint256)" --rpc-url <RPC_URL>

# Verify token supply (81M * 10^18)
cast call 0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16 "totalSupply()(uint256)" --rpc-url <RPC_URL>

# Verify Hook points to correct Jar
cast call <HOOK_ADDRESS> "jar()(address)" --rpc-url <RPC_URL>
```

4. **Claimable balances spot-checked** for several token IDs
5. **Test transaction on fork** via `cast --fork-url`
6. **Second pair of eyes** has reviewed fix and state audit

### Key Compromise Recovery

1. Pause all contracts immediately
2. Assess damage -- check all owner-only functions for unauthorized calls
3. Deploy new contracts (Hook must be redeployed since owner is immutable)
4. Migrate state -- reconstruct Jar claimable balances
5. Update frontend contract addresses

### Post-Mortem

Within 48 hours of P0/P1 resolution, create a GitHub issue with timeline, root cause, impact, lessons learned, and action items.

---

## 6. Key Holders

### Current State (Testnet)

All four Ownable contracts are owned by a single deployer EOA.

| Contract | Ownership Model | Transferable? |
|---|---|---|
| DaoDeGenJar | OZ `Ownable` | Yes -- `transferOwnership()` |
| VerseNFT | OZ `Ownable` | Yes -- `transferOwnership()` |
| AgentRegistry | OZ `Ownable` | Yes -- `transferOwnership()` |
| DaoDeGenHook | `immutable owner` | **No** -- must redeploy |
| DaoDeGenToken | No owner | N/A |

### Planned (Pre-Mainnet -- Issue #110)

Transfer Jar, VerseNFT, and AgentRegistry ownership to a Gnosis Safe. Hook must be redeployed with the Safe as constructor `msg.sender`.

### Verify Current Owner

```bash
cast call 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336 "owner()(address)" --rpc-url <RPC_URL>
cast call 0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50 "owner()(address)" --rpc-url <RPC_URL>
cast call 0xBFE569F809b644703175Be603684Be0b7f6eee89 "owner()(address)" --rpc-url <RPC_URL>
cast call <HOOK_ADDRESS> "owner()(address)" --rpc-url <RPC_URL>
```

---

## 7. Contact Escalation

| Role | Contact | Availability |
|---|---|---|
| Primary On-Call (Deployer) | TBD | 24/7 for P0 |
| Secondary On-Call | TBD | 24/7 for P0 |
| Comms Lead (@srsmoneybizness) | TBD | Within 1 hour |

### Escalation Protocol

```
0 min   -- Incident detected -> Primary On-Call notified
5 min   -- Primary acknowledges (else escalate to Secondary)
15 min  -- Severity assigned. If P0: pause affected contracts.
30 min  -- First public acknowledgment (P0 only)
Ongoing -- Updates every 2 hours (P0) or 12 hours (P1)
```

---

## Appendix: Quick Reference -- Emergency Pause

```bash
export OWNER_KEY=<OWNER_PRIVATE_KEY>
export RPC=<RPC_URL>

# Pause Jar
cast send 0xd25a5C67F180811e43990B2A0148Ac0d93ab9336 "pause()" --private-key $OWNER_KEY --rpc-url $RPC

# Pause Hook
cast send <HOOK_ADDRESS> "setPaused(bool)" true --private-key $OWNER_KEY --rpc-url $RPC

# Pause VerseNFT
cast send 0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50 "pause()" --private-key $OWNER_KEY --rpc-url $RPC

# Pause AgentRegistry
cast send 0xBFE569F809b644703175Be603684Be0b7f6eee89 "pause()" --private-key $OWNER_KEY --rpc-url $RPC
```

## Known Limitations

1. **DaoDeGenToken has no pause.** If the ERC-20 is compromised, pause consumers (Jar, Hook).
2. **Hook owner is immutable.** Must redeploy to rotate ownership (#110).
3. **VerseNFT `ownerMint()` bypasses pause.** By design.
4. **AgentRegistry `revoke()` bypasses pause.** By design.
5. **No on-chain monitoring.** Detection relies on manual observation until #116 (Sentry) is implemented.
6. **Single EOA ownership.** Acceptable for testnet; must resolve before mainnet (#110).
