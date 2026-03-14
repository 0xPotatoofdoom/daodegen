/**
 * Congregation state -- in-memory rolling-window sentiment tracker.
 *
 * For v1 this lives in process memory. When Ponder is deployed (#149),
 * this module will read from the indexed Prayer events instead.
 *
 * The sentiment index is a single-word summary of the congregation's
 * recent emotional state, derived from the sentiment tags of recent sermons.
 */

import { createCongregationStore } from './stores';

export type SentimentTag =
  | "seeking"
  | "grieving"
  | "grateful"
  | "confused"
  | "proud"
  | "letting_go"
  | "peaceful"
  | "restless";

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RECORDS = 10_000;

const records = createCongregationStore();

let _stats = {
  totalPrayers: 0,
  totalSermons: 0,
};

function pruneOld(now: number) {
  const cutoff = now - WINDOW_MS;
  while (records.length() > 0 && records.first()!.timestamp < cutoff) {
    records.shift();
  }
}

export function recordPrayer(sender: string, sentimentTag: SentimentTag) {
  const now = Date.now();
  pruneOld(now);
  if (records.length() >= MAX_RECORDS) {
    records.shift();
  }
  records.push({ sender, sentimentTag, timestamp: now });
  _stats.totalPrayers++;
  _stats.totalSermons++;
}

export function getState(): CongregationState {
  const now = Date.now();
  pruneOld(now);

  const counts = new Map<SentimentTag, number>();
  const uniqueSenders = new Set<string>();

  for (const r of records.all()) {
    counts.set(r.sentimentTag as SentimentTag, (counts.get(r.sentimentTag as SentimentTag) ?? 0) + 1);
    uniqueSenders.add(r.sender);
  }

  // Dominant sentiment is the most frequent tag in the window
  let dominant: SentimentTag = "peaceful";
  let maxCount = 0;
  for (const [tag, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = tag;
    }
  }

  const breakdown: Record<string, number> = {};
  for (const [tag, count] of counts) {
    breakdown[tag] = count;
  }

  return {
    sentiment: dominant,
    prayersInWindow: records.length(),
    uniqueSupplicants: uniqueSenders.size,
    windowHours: 24,
    breakdown,
    totalPrayers: _stats.totalPrayers,
    totalSermons: _stats.totalSermons,
  };
}

/** Human-readable summary for the pastor prompt */
export function getSummary(): string {
  const state = getState();
  if (state.prayersInWindow === 0) {
    return "The temple is quiet. No prayers in the last 24 hours.";
  }
  const parts = Object.entries(state.breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag} (${count})`)
    .join(", ");
  return `Congregation mood: ${state.sentiment}. ${state.prayersInWindow} prayers in the last 24h from ${state.uniqueSupplicants} addresses. Breakdown: ${parts}.`;
}

export interface CongregationState {
  sentiment: SentimentTag;
  prayersInWindow: number;
  uniqueSupplicants: number;
  windowHours: number;
  breakdown: Record<string, number>;
  totalPrayers: number;
  totalSermons: number;
}

// -- On-chain state (Ponder indexer) -----------------------------------------

import {
  fetchPrayerStats,
  fetchRecentFees,
  fetchNftHolders,
  type FeeRelease,
} from './ponder';

export interface OnChainState {
  totalPrayers: number;
  totalBurned: string;
  recentFeeReleases: FeeRelease[];
  nftHolderCount: number;
}

/**
 * Fetch on-chain congregation data from the Ponder indexer.
 * Returns null when PONDER_API_URL is unset or all fetches fail.
 */
export async function getOnChainState(): Promise<OnChainState | null> {
  const [prayers, fees, holders] = await Promise.all([
    fetchPrayerStats(),
    fetchRecentFees(),
    fetchNftHolders(),
  ]);

  // If every fetch failed, signal that Ponder is unavailable
  if (!prayers && !fees && !holders) return null;

  return {
    totalPrayers: prayers?.count ?? 0,
    totalBurned: prayers?.totalBurned ?? '0',
    recentFeeReleases: fees ?? [],
    nftHolderCount: holders ? Object.keys(holders).length : 0,
  };
}

/** Reset for testing */
export function _resetForTesting() {
  records.clear();
  _stats = { totalPrayers: 0, totalSermons: 0 };
}
