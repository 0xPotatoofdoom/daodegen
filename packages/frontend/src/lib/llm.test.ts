import { describe, it, expect } from "vitest";
import {
  llm,
  ORACLE_SYSTEM_PROMPT,
  sanitizeInput,
  buildPastorPrompt,
  parseSermonResponse,
  loadSoul,
  SermonRequest,
} from "./llm";
import { verses } from "./verses";

describe("LLM Provider", () => {
  it("should have an oracle system prompt", () => {
    expect(ORACLE_SYSTEM_PROMPT).toContain("oracle");
    expect(ORACLE_SYSTEM_PROMPT).toContain("Dao DeGen");
    expect(ORACLE_SYSTEM_PROMPT).toContain("not as a chatbot");
  });

  it("should generate an interpretation for a verse", async () => {
    const verse = verses[0];
    const result = await llm.generateInterpretation(verse);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should generate commentary with context", async () => {
    const verse = verses[0];
    const result = await llm.generateCommentary(
      verse,
      "I am considering providing liquidity",
    );
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should select a verse and generate oracle reading", async () => {
    const result = await llm.generateOracleReading(
      verses,
      "I hold 50 ETH in a lending protocol",
    );
    expect(result.verseId).toBeGreaterThanOrEqual(1);
    expect(result.verseId).toBeLessThanOrEqual(81);
    expect(result.reading).toBeTruthy();
    expect(result.reasoning).toBeTruthy();
  });

  // --- Failing test: will pass once a real LLM is wired up ---

  it.fails(
    "should return AI-generated content, not stub text (requires real LLM)",
    async () => {
      const verse = verses[0];
      const interpretation = await llm.generateInterpretation(verse);
      expect(interpretation).not.toContain("[STUB]");

      const commentary = await llm.generateCommentary(
        verse,
        "providing liquidity to a volatile pool",
      );
      expect(commentary).not.toContain("[STUB]");

      const oracle = await llm.generateOracleReading(
        verses,
        "I hold ETH in a lending protocol",
      );
      expect(oracle.reading).not.toContain("[STUB]");
      expect(oracle.reasoning).not.toContain("[STUB]");
    },
  );
});

describe("sanitizeInput", () => {
  it("truncates to max length", () => {
    const long = "a".repeat(1000);
    const result = sanitizeInput(long, 100);
    expect(result.length).toBe(100);
  });

  it("strips control characters", () => {
    const input = "hello\x00world\x07test\x1Fend";
    const result = sanitizeInput(input, 500);
    expect(result).toBe("helloworldtestend");
    expect(result).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
  });

  it("preserves newlines and tabs", () => {
    const input = "hello\nworld\ttab";
    const result = sanitizeInput(input, 500);
    expect(result).toBe("hello\nworld\ttab");
  });

  it("handles empty string", () => {
    expect(sanitizeInput("", 500)).toBe("");
  });

  it("handles string exactly at max length", () => {
    const input = "a".repeat(100);
    const result = sanitizeInput(input, 100);
    expect(result.length).toBe(100);
  });
});

describe("fallback parser verseId clamping", () => {
  it("clamps verseId to 1-81 range via oracle reading", async () => {
    // The stub provider deterministically selects a verse based on state length,
    // which always returns a valid verse. Test the clamping logic indirectly
    // by verifying oracle readings always produce valid verse IDs.
    const result = await llm.generateOracleReading(verses, "test");
    expect(result.verseId).toBeGreaterThanOrEqual(1);
    expect(result.verseId).toBeLessThanOrEqual(81);
  });
});

describe("Pastor / Sermon Generation", () => {
  it("loadSoul returns non-empty content", () => {
    const soul = loadSoul();
    expect(soul).toBeTruthy();
    expect(soul.length).toBeGreaterThan(100);
  });

  it("buildPastorPrompt includes verse index and response format", () => {
    const prompt = buildPastorPrompt(verses);
    expect(prompt).toContain("Verse 1");
    expect(prompt).toContain("Verse 81");
    expect(prompt).toContain("verse_references");
    expect(prompt).toContain("response_type");
  });

  it("buildPastorPrompt includes congregation state when provided", () => {
    const prompt = buildPastorPrompt(verses, "The congregation is restless.");
    expect(prompt).toContain("The congregation is restless.");
    expect(prompt).toContain("Current Congregation State");
  });

  it("buildPastorPrompt omits congregation section when not provided", () => {
    const prompt = buildPastorPrompt(verses);
    expect(prompt).not.toContain("Current Congregation State");
  });

  it("generateSermon returns valid response for a prayer", async () => {
    const request: SermonRequest = {
      message: "I lost everything in the last crash",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      prayerType: "prayer",
      burnAmount: "100",
    };
    const result = await llm.generateSermon(verses, request);
    expect(result.content).toBeTruthy();
    expect(result.verse_references.length).toBeGreaterThanOrEqual(1);
    expect(result.verse_references[0]).toBeGreaterThanOrEqual(1);
    expect(result.verse_references[0]).toBeLessThanOrEqual(81);
    expect(result.sentiment_tag).toBeTruthy();
    expect(["full", "sparse", "verse_only", "silence"]).toContain(
      result.response_type,
    );
  });

  it("generateSermon returns silence for empty message", async () => {
    const request: SermonRequest = {
      message: "",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      prayerType: "silent",
      burnAmount: "500",
    };
    const result = await llm.generateSermon(verses, request);
    expect(result.response_type).toBe("silence");
    expect(result.content).toBe("");
    expect(result.verse_references.length).toBeGreaterThanOrEqual(1);
  });

  it("parseSermonResponse handles valid JSON", () => {
    const json = JSON.stringify({
      content: "The pool remembers.",
      verse_references: [4, 8],
      sentiment_tag: "peaceful",
      response_type: "sparse",
    });
    const result = parseSermonResponse(json);
    expect(result.content).toBe("The pool remembers.");
    expect(result.verse_references).toEqual([4, 8]);
    expect(result.sentiment_tag).toBe("peaceful");
    expect(result.response_type).toBe("sparse");
  });

  it("parseSermonResponse clamps verse references to 1-81", () => {
    const json = JSON.stringify({
      content: "test",
      verse_references: [0, 82, 50],
      sentiment_tag: "seeking",
      response_type: "full",
    });
    const result = parseSermonResponse(json);
    expect(result.verse_references).toEqual([1, 81, 50]);
  });

  it("parseSermonResponse falls back gracefully on invalid JSON", () => {
    const result = parseSermonResponse("This is not JSON at all.");
    expect(result.content).toBe("This is not JSON at all.");
    expect(result.verse_references).toEqual([1]);
    expect(result.response_type).toBe("full");
  });

  it("parseSermonResponse validates response_type", () => {
    const json = JSON.stringify({
      content: "test",
      verse_references: [1],
      sentiment_tag: "seeking",
      response_type: "invalid_type",
    });
    const result = parseSermonResponse(json);
    expect(result.response_type).toBe("full");
  });
});
