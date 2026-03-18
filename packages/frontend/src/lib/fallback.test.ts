import { describe, it, expect } from "vitest";
import {
  classifyPrayer,
  tier1Reflection,
  tier2VerseOnly,
  generateFallbackSermon,
} from "./fallback";
import { verses } from "./verses";

describe("Fallback: classifyPrayer", () => {
  it("classifies loss-related prayers", () => {
    expect(classifyPrayer("I got liquidated yesterday")).toBe("loss");
    expect(classifyPrayer("everything is gone, I got rekt")).toBe("loss");
  });

  it("classifies greed-related prayers", () => {
    expect(classifyPrayer("when moon? I want 100x")).toBe("greed");
    expect(classifyPrayer("should I ape in with leverage")).toBe("greed");
  });

  it("classifies seeking-related prayers", () => {
    expect(classifyPrayer("I need help finding my path")).toBe("seeking");
    expect(classifyPrayer("what should I do with my life")).toBe("seeking");
  });

  it("classifies gratitude-related prayers", () => {
    expect(classifyPrayer("I am grateful for everything")).toBe("gratitude");
    expect(classifyPrayer("thank you for this offering")).toBe("gratitude");
  });

  it("classifies letting_go-related prayers", () => {
    expect(classifyPrayer("I need to let go and move on")).toBe("letting_go");
    expect(classifyPrayer("time to walk away from this")).toBe("letting_go");
  });

  it("returns null for empty messages", () => {
    expect(classifyPrayer("")).toBeNull();
  });

  it("returns null for unclassifiable messages", () => {
    expect(classifyPrayer("abcxyz123")).toBeNull();
  });
});

describe("Fallback: tier1Reflection", () => {
  it("returns a reflection for a classifiable prayer", () => {
    const result = tier1Reflection("I lost everything in the crash", verses);
    expect(result).not.toBeNull();
    expect(result!.content).toBeTruthy();
    expect(result!.verse_references.length).toBeGreaterThanOrEqual(1);
    expect(result!.sentiment_tag).toBeTruthy();
    expect(result!.response_type).toBe("full");
  });

  it("returns null for unclassifiable prayer", () => {
    const result = tier1Reflection("abcxyz123", verses);
    expect(result).toBeNull();
  });

  it("returns deterministic results for the same input", () => {
    const a = tier1Reflection("I got rekt so bad", verses);
    const b = tier1Reflection("I got rekt so bad", verses);
    expect(a).toEqual(b);
  });

  it("can return different reflections for different inputs in same category", () => {
    // Different messages may hash to different indices
    const a = tier1Reflection("I lost my position", verses);
    const b = tier1Reflection("the rug pull wiped me out completely", verses);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // Both should be loss category
    expect(a!.sentiment_tag).toBe("grieving");
    expect(b!.sentiment_tag).toBe("grieving");
  });
});

describe("Fallback: tier2VerseOnly", () => {
  it("returns a verse-only response", () => {
    const result = tier2VerseOnly("some prayer text", verses);
    expect(result.response_type).toBe("verse_only");
    expect(result.content).toBeTruthy();
    expect(result.verse_references.length).toBe(1);
    expect(result.verse_references[0]).toBeGreaterThanOrEqual(1);
    expect(result.verse_references[0]).toBeLessThanOrEqual(81);
  });

  it("is deterministic for the same message", () => {
    const a = tier2VerseOnly("same message", verses);
    const b = tier2VerseOnly("same message", verses);
    expect(a.verse_references).toEqual(b.verse_references);
  });
});

describe("Fallback: generateFallbackSermon", () => {
  it("returns silence for empty message", () => {
    const result = generateFallbackSermon("", verses);
    expect(result.response_type).toBe("silence");
    expect(result.content).toBe("");
    expect(result.verse_references.length).toBeGreaterThanOrEqual(1);
  });

  it("returns tier 1 reflection for classifiable prayer", () => {
    const result = generateFallbackSermon("I lost everything", verses);
    expect(result.response_type).toBe("full");
    expect(result.content).toBeTruthy();
    expect(result.sentiment_tag).toBe("grieving");
  });

  it("returns tier 2 verse-only for unclassifiable prayer", () => {
    const result = generateFallbackSermon("xyzzy plugh 42", verses);
    expect(result.response_type).toBe("verse_only");
    expect(result.content).toBeTruthy();
  });

  it("always returns valid verse references", () => {
    const prayers = [
      "",
      "I got liquidated",
      "when moon lambo",
      "what should I do",
      "thank you",
      "random gibberish here",
    ];
    for (const prayer of prayers) {
      const result = generateFallbackSermon(prayer, verses);
      expect(result.verse_references.length).toBeGreaterThanOrEqual(1);
      for (const ref of result.verse_references) {
        expect(ref).toBeGreaterThanOrEqual(1);
        expect(ref).toBeLessThanOrEqual(81);
      }
    }
  });
});
