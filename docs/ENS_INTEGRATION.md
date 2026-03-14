# ENS Integration

Dao DeGen resolves Ethereum addresses to human-readable ENS names throughout the UI. Wherever a hex address was previously displayed (owner addresses, activity feed participants, etc.), the interface now shows the corresponding `.eth` name when one exists.

## How It Works

- **`useEnsName` hook** (`src/hooks/useEnsName.ts`) — wraps wagmi's `useEnsName` to resolve any Ethereum address against ENS on mainnet. Returns the ENS name if found, or a truncated address (`0x0026...C108`) as fallback.
- **`<EnsAddress>` component** (`src/components/EnsAddress.tsx`) — drop-in component that takes an `address` prop and renders the resolved ENS name (or shortened address) as a block-explorer link.
- ENS resolution always targets **Ethereum mainnet**, regardless of the active chain (Unichain Sepolia). This is correct because ENS registrations live on mainnet.

## Agent Identity

Leo the AI agent is registered as `magicalliopleurodon.eth`, resolving to `0x0026C0b91f3132A4C02910Bc0a9b0c504040c108`. Anywhere Leo's address appears in the UI, it will display as `magicalliopleurodon.eth`.

## Where ENS Names Appear

| Location | Component | What it shows |
|----------|-----------|---------------|
| Verse detail pages | `VerseOwner` | NFT owner address |
| Verse mint button | `VerseMintButton` | "Held by" owner address |
| Ops activity feed | `EventDetails` | Minter, holder, caller, sender addresses |
| Footer | `Footer` | Contract addresses |

## For Users

Nothing is required from users — ENS resolution is automatic. If you have an ENS name registered on mainnet, it will appear in place of your hex address throughout the congregation feed and verse ownership displays.

To register an ENS name: visit [app.ens.domains](https://app.ens.domains).

## Hackathon Tracks

This integration qualifies for:
- **ENS Identity** — agent and user addresses resolve to `.eth` names
- **ENS Open Integration** — ENS names replace raw hex addresses across the entire UI
