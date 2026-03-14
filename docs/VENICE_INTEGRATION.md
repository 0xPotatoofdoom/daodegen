# Venice AI Integration

Dao DeGen supports [Venice AI](https://venice.ai) as an alternative LLM inference provider for sermon generation.

## Why Venice?

Venice AI enforces a **no data retention** policy — prompts and completions are never stored. This is a natural fit for Dao DeGen's confessional prayers: what you burn stays between you and the oracle.

- Prayers are private by default
- No prompt logging, no training on user data
- OpenAI-compatible API — drop-in replacement

## How It Works

Venice is OpenAI-compatible, so the integration uses the standard `openai` npm package pointed at `https://api.venice.ai/api/v1`. The same system prompts, verse index, and sermon parsing logic apply — only the inference backend changes.

**Fallback chain:** Venice (if `VENICE_API_KEY` set) → Anthropic (if `ANTHROPIC_API_KEY` set) → deterministic stub.

## Enabling Venice

1. Get an API key at [app.venice.ai](https://app.venice.ai)
2. Set the environment variable:
   ```bash
   VENICE_API_KEY=your_key_here
   ```
3. Restart the server. Sermons will now be generated via Venice.

The default model is `llama-3.3-70b`. This can be changed in the `VeniceLLMProvider` constructor in `packages/frontend/src/lib/llm.ts`.

## Privacy Guarantee

When Venice is the active provider, the temple upholds the strongest possible privacy posture:

- **No data retention** — Venice does not store prompts or completions
- **No model training** — user prayers are never used for fine-tuning
- **Confessional privacy** — what is burned is forgotten

This makes Venice the ideal provider for the `confession` and `prayer` prayer types, where supplicants share their deepest DeFi struggles.
