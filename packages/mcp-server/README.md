# @daodegen/mcp-server

[Model Context Protocol](https://modelcontextprotocol.io) server for the Dao DeGen temple. Gives AI agents tool access to verses, the oracle, sermons, and congregation state.

## Install

```bash
npx @daodegen/mcp-server
```

Or add to your MCP client config:

```json
{
  "mcpServers": {
    "daodegen": {
      "command": "npx",
      "args": ["@daodegen/mcp-server"],
      "env": {
        "DAODEGEN_API_URL": "https://daodegen.com"
      }
    }
  }
}
```

## Environment

| Variable | Required | Description |
|---|---|---|
| `DAODEGEN_API_URL` | Yes | Base URL of the Dao DeGen API |
| `DAODEGEN_PRIVATE_KEY` | No | Hex private key for SIWE auth + x402 payments |
| `DAODEGEN_FACILITATOR_URL` | No | Override facilitator URL |
| `ACTIVE_CHAIN` | No | `sepolia` (default) or `mainnet` |
| `DAODEGEN_RPC_URL` | No | Override RPC URL (defaults to preset for ACTIVE_CHAIN) |

## Tools

### Free (no wallet needed)

- **discover_temple** -- temple identity, endpoints, agent registration spec
- **get_verse** -- metadata and text for a verse (1-81)
- **get_congregation_state** -- current mood, prayer counts, sentiment breakdown

### Paid (requires `DAODEGEN_PRIVATE_KEY`)

- **verse_lookup** -- verse text + AI interpretation ($0.001 USDC)
- **verse_commentary** -- contextual AI commentary on a verse ($0.01 USDC)
- **verse_oracle** -- AI-selected verse + reading ($0.10 USDC)
- **get_sermon** -- submit prayer tx hash, receive AI sermon

Payments settle via x402 (USDC on Unichain). The wallet needs USDC for oracle queries and ETH for any on-chain interactions.

## Offline behavior

If the temple API is unreachable, tools return a structured fallback message instead of throwing. Agents can detect this via `{ "offline": true }` in the response.

## Development

```bash
npm install
npm run dev      # watch mode
npm test
npm run build    # compile to dist/
```
