# SermonCommitment Escrow

## Problem

When a supplicant burns DAODEGEN via `PrayerBurn.pray()`, tokens are destroyed
immediately. But the sermon (AI-generated wisdom) is delivered off-chain through
an API call. If the API fails, the network is congested, or the pastor agent
goes offline, the supplicant loses tokens with nothing in return.

Judges in the "Agents That Cooperate" track score on **conditional payments
enforced by the contract, not a platform**. Without on-chain delivery
guarantees, the burn-to-sermon flow is a trust-me promise, not a trustless
protocol.

## Solution

`SermonCommitment` is an escrow contract that creates a verifiable, time-bound
commitment to deliver a sermon for every burn.

### Flow

```
Supplicant                PrayerBurn             SermonCommitment        Pastor API
    |                         |                         |                    |
    |-- pray(amount, msg) --> |                         |                    |
    |                         |-- createCommitment() -> |                    |
    |                         |<-- commitmentId --------|                    |
    |                         |-- emit PrayerBurned --->|                    |
    |                         |                         |                    |
    |-- POST /v1/sermon (commitment_id) ---------------------------------> |
    |                         |                         |                    |
    |                         |                         |<-- fulfill(id, h) -|
    |                         |                         |-- emit Fulfilled ->|
    |<---------------------- { sermon, fulfill_tx } ------------------------|
    |                         |                         |                    |

    If pastor fails to fulfill within 5 minutes:

    Anyone ------------------------------------------------ refund(id) ---> |
                                                            emit Refunded
```

### Key Design Decisions

1. **Time-bound fulfillment (300s).** The pastor has ~5 minutes to generate and
   post the wisdom hash. This is generous for an LLM call but tight enough to
   hold the agent accountable.

2. **Permissionless refund.** Anyone can call `refund()` after the deadline.
   This prevents the pastor from silently ignoring failed commitments.

3. **Wisdom hash, not wisdom text.** The contract stores `keccak256(sermon)`
   rather than the full text. This keeps gas costs low while proving delivery.
   Anyone can verify by hashing the returned sermon.

4. **Backward compatible.** The `sermonCommitment` address on PrayerBurn is
   optional. If not set, `pray()` works exactly as before. The API route also
   ignores `commitment_id` if the field is absent or the contract isn't
   configured.

5. **Pastor = agent address.** Only the registered pastor
   (`0x3D0e10329c864A7422761af058f909267a776029`) can fulfill commitments,
   establishing clear agent identity and accountability.

## Contract API

### SermonCommitment

| Function | Access | Description |
|----------|--------|-------------|
| `createCommitment(supplicant, burnAmount)` | Anyone (called by PrayerBurn) | Creates a new commitment, returns `bytes32 id` |
| `fulfill(commitmentId, wisdomHash)` | Pastor only | Marks commitment fulfilled with sermon hash |
| `refund(commitmentId)` | Anyone (after deadline) | Marks commitment refunded |
| `setPastor(address)` | Owner only | Updates the pastor address |

### PrayerBurn (updated)

| Function | Description |
|----------|-------------|
| `setSermonCommitment(address)` | Owner sets the escrow contract (0 = disabled) |

New event: `PrayerBurned(address indexed sender, uint256 amount, bytes32 commitmentId)`

### Sermon API (updated)

New optional request field: `commitment_id` (bytes32 hex string).
New optional response field: `fulfill_tx` (transaction hash of on-chain fulfill call).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SERMON_COMMITMENT_ADDRESS` | Deployed SermonCommitment contract address |
| `PASTOR_PRIVATE_KEY` | Private key for the pastor agent (server-side only) |

## Why This Matters

The SermonCommitment contract transforms DaoDeGen's burn-to-sermon pipeline from
a centralized API call into a verifiable agent coordination protocol. The pastor
agent makes a cryptographic commitment to deliver wisdom, and the blockchain
enforces the deadline. This is the foundation for trustless cooperation between
autonomous agents -- exactly what the "Agents That Cooperate" pillar demands.
