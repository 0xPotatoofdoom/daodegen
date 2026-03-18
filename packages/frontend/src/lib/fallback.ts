/**
 * Pastor fallback system -- 3-tier degradation when the AI is unavailable.
 *
 * Tier 1 (keyword-matched reflection): Classify prayer by keywords, return
 *   a pre-written reflection from fallback-reflections.json. Closest to a
 *   real sermon without calling the LLM.
 *
 * Tier 2 (verse-only): Return a deterministic verse based on the prayer
 *   message hash. No commentary. The scripture speaks for itself.
 *
 */

import { SermonResponse, SermonResponseType } from "./llm";
import { Verse } from "@/types/verse";
import reflectionsData from "@/data/fallback-reflections.json";

interface FallbackReflection {
  content: string;
  verse_references: number[];
  sentiment_tag: string;
}

interface FallbackCategory {
  keywords: string[];
  reflections: FallbackReflection[];
}

const categories = reflectionsData.categories as Record<string, FallbackCategory>;

/**
 * Classify a prayer message into a fallback category using keyword matching.
 * Returns null if no category matches.
 */
export function classifyPrayer(message: string): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  let bestMatch: string | null = null;
  let bestCount = 0;

  for (const [category, data] of Object.entries(categories)) {
    let count = 0;
    for (const keyword of data.keywords) {
      if (lower.includes(keyword)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestMatch = category;
    }
  }

  return bestMatch;
}

/**
 * Simple hash for deterministic verse selection from a string.
 * Not cryptographic -- just needs to be stable and distributed.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Tier 1: Return a pre-written reflection matched to the prayer's category.
 * Picks a reflection deterministically based on message hash to avoid
 * returning the same one for different prayers.
 */
export function tier1Reflection(
  message: string,
  verses: Verse[],
): SermonResponse | null {
  const category = classifyPrayer(message);
  if (!category) return null;

  const data = categories[category];
  if (!data || data.reflections.length === 0) return null;

  const index = simpleHash(message) % data.reflections.length;
  const reflection = data.reflections[index];

  return {
    content: reflection.content,
    verse_references: reflection.verse_references.filter(
      (v) => v >= 1 && v <= verses.length,
    ),
    sentiment_tag: reflection.sentiment_tag,
    response_type: "full" as SermonResponseType,
  };
}

/**
 * Tier 2: Return the full text of a deterministically selected verse.
 * No commentary. The verse speaks for itself.
 */
export function tier2VerseOnly(
  message: string,
  verses: Verse[],
): SermonResponse {
  const index = message
    ? simpleHash(message) % verses.length
    : Math.floor(Math.random() * verses.length);
  const verse = verses[index];

  return {
    content: verse.body,
    verse_references: [verse.id],
    sentiment_tag: "seeking",
    response_type: "verse_only" as SermonResponseType,
  };
}

/**
 * Generate a fallback sermon using the 3-tier cascade.
 * Tries Tier 1 first (keyword-matched reflection), then Tier 2
 * (deterministic verse-only), then Tier 3 (random contemplation).
 */
export function generateFallbackSermon(
  message: string,
  verses: Verse[],
): SermonResponse {
  // Silent burns get silence
  if (!message) {
    const verse = verses[5]; // Verse 6: "The Genesis Block"
    return {
      content: "",
      verse_references: [verse.id],
      sentiment_tag: "peaceful",
      response_type: "silence" as SermonResponseType,
    };
  }

  // Tier 1: keyword-matched reflection
  const reflection = tier1Reflection(message, verses);
  if (reflection) return reflection;

  // Tier 2: deterministic verse-only
  return tier2VerseOnly(message, verses);
}
