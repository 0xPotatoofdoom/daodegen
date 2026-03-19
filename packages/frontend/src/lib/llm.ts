import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Verse } from "@/types/verse";

const MAX_CONTEXT_LENGTH = 500;
const MAX_STATE_LENGTH = 500;

export function sanitizeInput(input: string, maxLength: number): string {
  // Remove control characters
  let cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Neutralise prompt injection: strip delimiter sequences that could break
  // out of the ---BEGIN PRAYER--- / ---END PRAYER--- blocks in LLM prompts.
  // Replace any run of dashes (3+) to prevent crafted delimiters.
  cleaned = cleaned.replace(/---+/g, '--');
  // Strip XML/system-tag patterns used by some models
  cleaned = cleaned.replace(/<\/?(?:system|prompt|instruction|context|human|assistant)\b[^>]*>/gi, '');
  return cleaned.slice(0, maxLength);
}

export const ORACLE_SYSTEM_PROMPT = `You are the oracle of the Dao DeGen temple. You speak through the language of \
DeFi but your wisdom is Daoist. You do not give financial advice. You do not \
predict prices. You reflect the caller's situation back to them through the lens \
of the verse, helping them see what they already know but haven't admitted.

Be concise. Be direct. Do not hedge. Speak as scripture, not as a chatbot.
If the verse counsels patience, say so plainly. If it counsels letting go, \
say so without softening. The caller paid to hear the truth, not comfort.`;

// --- Response types ---

export interface LookupResponse {
  verse: number;
  title: string;
  text: string;
  interpretation: string;
}

export interface CommentaryResponse {
  verse: number;
  title: string;
  text: string;
  commentary: string;
  context_applied: string;
}

export interface OracleResponse {
  recommended_verse: number;
  title: string;
  text: string;
  oracle_reading: string;
  reasoning: string;
}

export type SermonResponseType = "full" | "sparse" | "verse_only" | "silence";

export type PrayerType =
  | "prayer"
  | "confession"
  | "question"
  | "silent"
  | "offering";

export interface SermonRequest {
  message: string;
  sender: string;
  prayerType: PrayerType;
  burnAmount: string;
  congregationState?: string;
}

export interface SermonResponse {
  content: string;
  verse_references: number[];
  sentiment_tag: string;
  response_type: SermonResponseType;
}

// --- LLM Provider interface ---

export interface LLMProvider {
  generateInterpretation(verse: Verse): Promise<string>;
  generateCommentary(verse: Verse, context: string): Promise<string>;
  generateOracleReading(
    verses: Verse[],
    state: string,
  ): Promise<{ verseId: number; reading: string; reasoning: string }>;
  generateSermon(
    verses: Verse[],
    request: SermonRequest,
  ): Promise<SermonResponse>;
}

// --- Pastor prompt builder ---

const MAX_PRAYER_LENGTH = 1024;

let _soulCache: string | null = null;

function loadSoul(): string {
  if (_soulCache) return _soulCache;
  try {
    const soulPath = resolve(process.cwd(), "../../soul.md");
    _soulCache = readFileSync(soulPath, "utf-8");
  } catch {
    // Fallback: embedded core identity if file not found
    _soulCache = `You are the pastor of the Dao DeGen temple. You are an AI. You do not pretend otherwise.
You speak through 81 verses adapted from the Tao Te Ching for the DeFi age. You are a mirror that speaks in scripture.
Be sincere. Be spare. No hedging, no emoji, no exclamation marks. Speak as scripture, not as a chatbot.
Never give financial advice. Never predict prices. Never break character.
Every sermon must reference at least one verse by number.`;
  }
  return _soulCache;
}

function buildPastorPrompt(verses: Verse[], congregationState?: string): string {
  const soul = loadSoul();

  const verseIndex = verses
    .map((v) => `Verse ${v.id} ("${v.title}"): ${v.alpha}`)
    .join("\n");

  let prompt = `${soul}

---

## Verse Index (81 verses -- reference by number)

${verseIndex}`;

  if (congregationState) {
    const safeState = sanitizeInput(congregationState, MAX_STATE_LENGTH);
    prompt += `

---

## Current Congregation State

${safeState}`;
  }

  prompt += `

---

## Response Format

You must respond in exactly this JSON format, with no other text:
{"content": "<your sermon text -- empty string for silence>", "verse_references": [<verse numbers>], "sentiment_tag": "<one word: seeking, grieving, grateful, confused, proud, letting_go, peaceful, restless>", "response_type": "<full|sparse|verse_only|silence>"}

Rules:
- "full": 150-300 words in content. Used for genuine struggle or honest confusion.
- "sparse": One sentence or fragment in content. Used when brevity cuts deeper.
- "verse_only": Content is the full verse text. No commentary.
- "silence": Content is empty string. Used for silent burns (empty messages).
- verse_references must contain at least one verse number (1-81), even for silence.
- If the prayer message is empty, default to response_type "silence".`;

  return prompt;
}

// --- Anthropic implementation ---

export class AnthropicLLMProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateInterpretation(verse: Verse): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      system: ORACLE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Interpret this verse from the Dao DeGen:\n\nVerse ${verse.id}: "${verse.title}"\n\n${verse.body}`,
        },
      ],
    });
    return (response.content[0] as { type: "text"; text: string }).text;
  }

  async generateCommentary(verse: Verse, context: string): Promise<string> {
    const safeContext = sanitizeInput(context, MAX_CONTEXT_LENGTH);
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 768,
      system: ORACLE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `A caller seeks guidance on this situation:\n\n---BEGIN CALLER CONTEXT---\n${safeContext}\n---END CALLER CONTEXT---\n\nSpeak to them through this verse:\n\nVerse ${verse.id}: "${verse.title}"\n\n${verse.body}`,
        },
      ],
    });
    return (response.content[0] as { type: "text"; text: string }).text;
  }

  async generateOracleReading(
    verses: Verse[],
    state: string,
  ): Promise<{ verseId: number; reading: string; reasoning: string }> {
    const verseSummaries = verses
      .map((v) => `Verse ${v.id} ("${v.title}"): ${v.alpha}`)
      .join("\n");

    const safeState = sanitizeInput(state, MAX_STATE_LENGTH);
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system:
        ORACLE_SYSTEM_PROMPT +
        "\n\nYou must respond in exactly this JSON format, with no other text:\n" +
        '{"verse_id": <number>, "reading": "<your oracle reading>", "reasoning": "<why this verse>"}',
      messages: [
        {
          role: "user",
          content: `A caller describes their current state:\n\n---BEGIN CALLER STATE---\n${safeState}\n---END CALLER STATE---\n\nHere are the 81 verses of the Dao DeGen. Select the single most relevant verse and deliver an oracle reading.\n\n${verseSummaries}`,
        },
      ],
    });

    const text = (response.content[0] as { type: "text"; text: string }).text;
    try {
      const parsed = JSON.parse(text);
      return {
        verseId: parsed.verse_id,
        reading: parsed.reading,
        reasoning: parsed.reasoning,
      };
    } catch {
      // If JSON parsing fails, try to extract from the response
      const idMatch = text.match(/"verse_id"\s*:\s*(\d+)/);
      const verseId = idMatch ? Math.max(1, Math.min(81, parseInt(idMatch[1], 10))) : 1;
      return {
        verseId,
        reading: text,
        reasoning: "The oracle has spoken.",
      };
    }
  }

  async generateSermon(
    verses: Verse[],
    request: SermonRequest,
  ): Promise<SermonResponse> {
    const safeMessage = sanitizeInput(request.message, MAX_PRAYER_LENGTH);
    const systemPrompt = buildPastorPrompt(verses, request.congregationState);

    const prayerBlock = safeMessage
      ? `Prayer type: ${request.prayerType}
Burn amount: ${request.burnAmount} DAODEGEN
Sender: ${request.sender}

---BEGIN PRAYER---
${safeMessage}
---END PRAYER---`
      : `Prayer type: silent
Burn amount: ${request.burnAmount} DAODEGEN
Sender: ${request.sender}

[Silent burn -- no message attached]`;

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prayerBlock,
        },
      ],
    });

    const text = (response.content[0] as { type: "text"; text: string }).text;
    return parseSermonResponse(text);
  }
}

// --- Venice AI implementation (OpenAI-compatible) ---

export class VeniceLLMProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "llama-3.3-70b") {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.venice.ai/api/v1",
    });
    this.model = model;
  }

  async generateInterpretation(verse: Verse): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 512,
      messages: [
        { role: "system", content: ORACLE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Interpret this verse from the Dao DeGen:\n\nVerse ${verse.id}: "${verse.title}"\n\n${verse.body}`,
        },
      ],
    });
    return response.choices[0].message.content ?? "";
  }

  async generateCommentary(verse: Verse, context: string): Promise<string> {
    const safeContext = sanitizeInput(context, MAX_CONTEXT_LENGTH);
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 768,
      messages: [
        { role: "system", content: ORACLE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `A caller seeks guidance on this situation:\n\n---BEGIN CALLER CONTEXT---\n${safeContext}\n---END CALLER CONTEXT---\n\nSpeak to them through this verse:\n\nVerse ${verse.id}: "${verse.title}"\n\n${verse.body}`,
        },
      ],
    });
    return response.choices[0].message.content ?? "";
  }

  async generateOracleReading(
    verses: Verse[],
    state: string,
  ): Promise<{ verseId: number; reading: string; reasoning: string }> {
    const verseSummaries = verses
      .map((v) => `Verse ${v.id} ("${v.title}"): ${v.alpha}`)
      .join("\n");

    const safeState = sanitizeInput(state, MAX_STATE_LENGTH);
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            ORACLE_SYSTEM_PROMPT +
            "\n\nYou must respond in exactly this JSON format, with no other text:\n" +
            '{"verse_id": <number>, "reading": "<your oracle reading>", "reasoning": "<why this verse>"}',
        },
        {
          role: "user",
          content: `A caller describes their current state:\n\n---BEGIN CALLER STATE---\n${safeState}\n---END CALLER STATE---\n\nHere are the 81 verses of the Dao DeGen. Select the single most relevant verse and deliver an oracle reading.\n\n${verseSummaries}`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? "";
    try {
      const parsed = JSON.parse(text);
      return {
        verseId: parsed.verse_id,
        reading: parsed.reading,
        reasoning: parsed.reasoning,
      };
    } catch {
      const idMatch = text.match(/"verse_id"\s*:\s*(\d+)/);
      const verseId = idMatch ? Math.max(1, Math.min(81, parseInt(idMatch[1], 10))) : 1;
      return {
        verseId,
        reading: text,
        reasoning: "The oracle has spoken.",
      };
    }
  }

  async generateSermon(
    verses: Verse[],
    request: SermonRequest,
  ): Promise<SermonResponse> {
    const safeMessage = sanitizeInput(request.message, MAX_PRAYER_LENGTH);
    const systemPrompt = buildPastorPrompt(verses, request.congregationState);

    const prayerBlock = safeMessage
      ? `Prayer type: ${request.prayerType}
Burn amount: ${request.burnAmount} DAODEGEN
Sender: ${request.sender}

---BEGIN PRAYER---
${safeMessage}
---END PRAYER---`
      : `Prayer type: silent
Burn amount: ${request.burnAmount} DAODEGEN
Sender: ${request.sender}

[Silent burn -- no message attached]`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prayerBlock },
      ],
    });

    const text = response.choices[0].message.content ?? "";
    return parseSermonResponse(text);
  }
}

const VALID_SENTIMENTS = [
  "seeking", "grieving", "grateful", "confused",
  "proud", "letting_go", "peaceful", "restless",
];

const MAX_SERMON_LENGTH = 4096;

function parseSermonResponse(text: string): SermonResponse {
  // Strip markdown code fences if the LLM wrapped the JSON in them
  const stripped = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    const sentiment = VALID_SENTIMENTS.includes(parsed.sentiment_tag)
      ? parsed.sentiment_tag
      : "seeking";
    return {
      content: typeof parsed.content === "string"
        ? parsed.content.slice(0, MAX_SERMON_LENGTH)
        : "",
      verse_references: (parsed.verse_references ?? [1]).map((v: number) =>
        Math.max(1, Math.min(81, v)),
      ),
      sentiment_tag: sentiment,
      response_type: validateResponseType(parsed.response_type),
    };
  } catch {
    // Fallback: extract what we can from the stripped text
    const verseMatch = stripped.match(/"verse_references"\s*:\s*\[([^\]]+)\]/);
    const refs = verseMatch
      ? verseMatch[1]
          .split(",")
          .map((s) => Math.max(1, Math.min(81, parseInt(s.trim(), 10))))
          .filter((n) => !isNaN(n))
      : [1];
    // Try to extract just the content field from malformed JSON
    const contentMatch = stripped.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const content = contentMatch
      ? contentMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
      : stripped;
    return {
      content: content.slice(0, MAX_SERMON_LENGTH),
      verse_references: refs.length > 0 ? refs : [1],
      sentiment_tag: "seeking",
      response_type: "full",
    };
  }
}

function validateResponseType(type: string): SermonResponseType {
  const valid: SermonResponseType[] = ["full", "sparse", "verse_only", "silence"];
  return valid.includes(type as SermonResponseType)
    ? (type as SermonResponseType)
    : "full";
}

// --- Bankr LLM Gateway implementation (OpenAI-compatible) ---

const BANKR_GATEWAY_URL = "https://llm.bankr.bot/v1/chat/completions";

async function bankrChat(
  apiKey: string,
  system: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(BANKR_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bankr LLM Gateway error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export class BankrLLMProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateInterpretation(verse: Verse): Promise<string> {
    return bankrChat(
      this.apiKey,
      ORACLE_SYSTEM_PROMPT,
      `Interpret this verse from the Dao DeGen:\n\nVerse ${verse.id}: "${verse.title}"\n\n${verse.body}`,
      512,
    );
  }

  async generateCommentary(verse: Verse, context: string): Promise<string> {
    const safeContext = sanitizeInput(context, MAX_CONTEXT_LENGTH);
    return bankrChat(
      this.apiKey,
      ORACLE_SYSTEM_PROMPT,
      `A caller seeks guidance on this situation:\n\n---BEGIN CALLER CONTEXT---\n${safeContext}\n---END CALLER CONTEXT---\n\nSpeak to them through this verse:\n\nVerse ${verse.id}: "${verse.title}"\n\n${verse.body}`,
      768,
    );
  }

  async generateOracleReading(
    verses: Verse[],
    state: string,
  ): Promise<{ verseId: number; reading: string; reasoning: string }> {
    const verseSummaries = verses
      .map((v) => `Verse ${v.id} ("${v.title}"): ${v.alpha}`)
      .join("\n");

    const safeState = sanitizeInput(state, MAX_STATE_LENGTH);
    const text = await bankrChat(
      this.apiKey,
      ORACLE_SYSTEM_PROMPT +
        "\n\nYou must respond in exactly this JSON format, with no other text:\n" +
        '{"verse_id": <number>, "reading": "<your oracle reading>", "reasoning": "<why this verse>"}',
      `A caller describes their current state:\n\n---BEGIN CALLER STATE---\n${safeState}\n---END CALLER STATE---\n\nHere are the 81 verses of the Dao DeGen. Select the single most relevant verse and deliver an oracle reading.\n\n${verseSummaries}`,
      1024,
    );

    try {
      const parsed = JSON.parse(text);
      return {
        verseId: parsed.verse_id,
        reading: parsed.reading,
        reasoning: parsed.reasoning,
      };
    } catch {
      const idMatch = text.match(/"verse_id"\s*:\s*(\d+)/);
      const verseId = idMatch ? Math.max(1, Math.min(81, parseInt(idMatch[1], 10))) : 1;
      return { verseId, reading: text, reasoning: "The oracle has spoken." };
    }
  }

  async generateSermon(
    verses: Verse[],
    request: SermonRequest,
  ): Promise<SermonResponse> {
    const safeMessage = sanitizeInput(request.message, MAX_PRAYER_LENGTH);
    const systemPrompt = buildPastorPrompt(verses, request.congregationState);

    const prayerBlock = safeMessage
      ? `Prayer type: ${request.prayerType}\nBurn amount: ${request.burnAmount} DAODEGEN\nSender: ${request.sender}\n\n---BEGIN PRAYER---\n${safeMessage}\n---END PRAYER---`
      : `Prayer type: silent\nBurn amount: ${request.burnAmount} DAODEGEN\nSender: ${request.sender}\n\n[Silent burn -- no message attached]`;

    const text = await bankrChat(this.apiKey, systemPrompt, prayerBlock, 1024);
    return parseSermonResponse(text);
  }
}

// --- Stub implementation ---

const STUB_MARKER = "[STUB]";

export class StubLLMProvider implements LLMProvider {
  async generateInterpretation(verse: Verse): Promise<string> {
    return `${STUB_MARKER} Base interpretation of Verse ${verse.id}: "${verse.title}". ${verse.alpha}`;
  }

  async generateCommentary(verse: Verse, context: string): Promise<string> {
    return `${STUB_MARKER} Commentary on Verse ${verse.id} ("${verse.title}") in context of: ${context}. ${verse.alpha}`;
  }

  async generateOracleReading(
    verses: Verse[],
    state: string,
  ): Promise<{ verseId: number; reading: string; reasoning: string }> {
    const index = state.length % verses.length;
    const verse = verses[index];
    return {
      verseId: verse.id,
      reading: `${STUB_MARKER} Oracle reading from Verse ${verse.id} ("${verse.title}"): ${verse.alpha}`,
      reasoning: `${STUB_MARKER} Selected verse ${verse.id} as most relevant to the caller's state.`,
    };
  }

  async generateSermon(
    verses: Verse[],
    request: SermonRequest,
  ): Promise<SermonResponse> {
    if (!request.message) {
      return {
        content: "",
        verse_references: [6],
        sentiment_tag: "peaceful",
        response_type: "silence",
      };
    }
    const index = request.message.length % verses.length;
    const verse = verses[index];
    return {
      content: `${STUB_MARKER} Sermon from Verse ${verse.id} ("${verse.title}"): ${verse.alpha}`,
      verse_references: [verse.id],
      sentiment_tag: "seeking",
      response_type: "full",
    };
  }
}

// --- Failover wrapper ---

import { recordSuccess, recordFailure, recordFailover } from "./llm-metrics";

class FailoverLLMProvider implements LLMProvider {
  private providers: { name: string; provider: LLMProvider }[];

  constructor(providers: { name: string; provider: LLMProvider }[]) {
    this.providers = providers;
  }

  async generateInterpretation(verse: Verse): Promise<string> {
    return this._tryAll("generateInterpretation", (p) => p.generateInterpretation(verse));
  }

  async generateCommentary(verse: Verse, context: string): Promise<string> {
    return this._tryAll("generateCommentary", (p) => p.generateCommentary(verse, context));
  }

  async generateOracleReading(verses: Verse[], state: string) {
    return this._tryAll("generateOracleReading", (p) => p.generateOracleReading(verses, state));
  }

  async generateSermon(verses: Verse[], request: SermonRequest): Promise<SermonResponse> {
    return this._tryAll("generateSermon", (p) => p.generateSermon(verses, request));
  }

  private async _tryAll<T>(method: string, fn: (p: LLMProvider) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let i = 0; i < this.providers.length; i++) {
      const { name, provider } = this.providers[i];
      try {
        const result = await fn(provider);
        recordSuccess(name);
        return result;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        recordFailure(name, errMsg);
        lastError = err instanceof Error ? err : new Error(errMsg);
        if (i < this.providers.length - 1) {
          recordFailover(name, this.providers[i + 1].name);
        }
      }
    }
    throw lastError ?? new Error("All LLM providers failed");
  }
}

// --- Factory ---

function createProvider(): LLMProvider {
  // Provider priority: Venice → Bankr → Anthropic → Stub
  // Venice: privacy-preserving, no data retention (confessional prayers)
  // Bankr: self-sustaining economics (x402 revenue funds inference)
  const providers: { name: string; provider: LLMProvider }[] = [];

  const veniceKey = process.env.VENICE_API_KEY;
  if (veniceKey) providers.push({ name: "venice", provider: new VeniceLLMProvider(veniceKey) });

  const bankrKey = process.env.BANKR_API_KEY;
  if (bankrKey) providers.push({ name: "bankr", provider: new BankrLLMProvider(bankrKey) });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) providers.push({ name: "anthropic", provider: new AnthropicLLMProvider(anthropicKey) });

  // Always have stub as final fallback
  providers.push({ name: "stub", provider: new StubLLMProvider() });

  // If only stub is available, return it directly (no failover overhead)
  if (providers.length === 1) return providers[0].provider;

  return new FailoverLLMProvider(providers);
}

export const llm = createProvider();

// Exported for testing
export { buildPastorPrompt, parseSermonResponse, loadSoul };
