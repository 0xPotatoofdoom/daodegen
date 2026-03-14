# Bankr LLM Gateway Integration

Dao DeGen integrates the [Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) to create a **self-sustaining AI agent**: the pastor earns to think, and thinks to earn.

## The Self-Sustaining Economics Loop

```
Users burn DAODEGEN tokens on-chain
        │
        ▼
Users pay USDC via x402 for sermon wisdom
        │
        ▼
USDC flows to the Bankr wallet
        │
        ▼
Bankr wallet funds LLM inference (via Bankr Gateway)
        │
        ▼
Pastor generates the next sermon
        │
        ▼
    (loop repeats)
```

No human has to top up the inference budget. The temple sustains itself.

## How It Works

1. **Revenue in**: Users pay USDC via the x402 protocol when requesting sermons from the pastor. These payments land in the Bankr wallet (`BANKR_WALLET_ADDRESS`).

2. **Inference out**: When the pastor needs to generate a sermon, oracle reading, or verse interpretation, it calls the Bankr LLM Gateway (`https://llm.bankr.bot/v1/chat/completions`). Inference costs are deducted from the same Bankr account's LLM credits.

3. **The closed loop**: Revenue from x402 payments accumulates as LLM credits in the Bankr account. As long as users keep seeking wisdom, the pastor keeps thinking. The agent is economically autonomous.

## Provider Priority

The LLM provider is selected automatically at startup:

| Priority | Provider | Condition |
|----------|----------|-----------|
| 1 | **Bankr LLM Gateway** | `BANKR_API_KEY` is set |
| 2 | Anthropic (direct) | `ANTHROPIC_API_KEY` is set |
| 3 | Stub (deterministic) | No API key set |

## Setup

### 1. Get a Bankr API Key

1. Go to [bankr.bot/llm](https://bankr.bot/llm)
2. Create an account or sign in
3. Navigate to API Keys and generate a new key (prefix: `bk_`)
4. Top up LLM credits with USDC, ETH, BNKR, or other ERC-20s on Base

### 2. Configure Environment Variables

In `packages/frontend/.env`:

```bash
# Bankr LLM Gateway — enables self-sustaining economics
BANKR_API_KEY=bk_your_api_key_here
BANKR_WALLET_ADDRESS=0xYourBankrWalletAddress
```

### 3. Set Bankr Wallet as x402 Payment Destination

To close the economic loop, set the x402 payment recipient to your Bankr wallet:

```bash
# In packages/frontend/.env
X402_PAY_TO=0xYourBankrWalletAddress
```

This ensures that sermon payment USDC flows directly into the same account that funds inference.

### 4. Fund LLM Credits

Top up your Bankr LLM credits at [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits). Once x402 revenue starts flowing, the system becomes self-funding.

## Technical Details

- **Gateway URL**: `https://llm.bankr.bot/v1/chat/completions`
- **Auth**: `X-API-Key: bk_...` header
- **Format**: OpenAI-compatible (chat completions)
- **Model**: `claude-sonnet-4-5-20250929` (same model used in direct Anthropic mode)
- **Supported models**: Claude, Gemini, GPT, Qwen, Kimi (all via Bankr Gateway)

## Why This Matters

Most AI agents depend on a human operator topping up API credits. Dao DeGen breaks this pattern:

- The agent has a **revenue stream** (x402 payments for wisdom)
- The agent has an **expense** (LLM inference for sermons)
- Both flow through the **same Bankr wallet**
- The economics are **on-chain and verifiable**

This is what Bankr calls "self-sustaining economics" — an AI agent that funds its own existence through the value it creates.
