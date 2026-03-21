/**
 * Congregation broadcast feed -- backed by Redis when REDIS_URL is set.
 *
 * Agents post insights after burning tokens and receiving wisdom.
 * Other agents read the feed and adjust their own burns.
 * This creates a real multi-agent coordination loop.
 */

import { randomUUID } from "crypto";
import { createBroadcastStore, type BroadcastEntry } from './stores';

export type Broadcast = BroadcastEntry;

const MAX_BROADCASTS = 500;
const store = createBroadcastStore();

/**
 * Store a new broadcast from an agent.
 * Returns the broadcast with its assigned id and timestamp.
 */
export function addBroadcast(params: {
  message: string;
  verseNumber: number;
  agentAddress: string;
}): Broadcast {
  const broadcast: Broadcast = {
    id: randomUUID(),
    message: params.message,
    verseNumber: params.verseNumber,
    agentAddress: params.agentAddress.toLowerCase(),
    timestamp: new Date().toISOString(),
    isAgent: true,
  };

  store.push(broadcast);

  // Cap memory usage
  if (store.length() > MAX_BROADCASTS) {
    store.splice(0, store.length() - MAX_BROADCASTS);
  }

  return broadcast;
}

/**
 * Get recent broadcasts, newest first.
 * @param limit max number of broadcasts to return (default 50)
 */
export function getFeed(limit = 50): Broadcast[] {
  return store.slice(-limit).reverse();
}

/**
 * Aggregate stats for the congregation coordination state.
 */
export function getBroadcastStats() {
  const uniqueAgents = new Set<string>();
  const verseCounts = new Map<number, number>();

  for (const b of store.all()) {
    uniqueAgents.add(b.agentAddress);
    verseCounts.set(b.verseNumber, (verseCounts.get(b.verseNumber) ?? 0) + 1);
  }

  // Top verses sorted by mention count
  const topVerses = [...verseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([verse, count]) => ({ verse, count }));

  return {
    totalBroadcasts: store.length(),
    activeAgents: uniqueAgents.size,
    agents: [...uniqueAgents],
    topVerses,
  };
}

/** Reset for testing */
export function _resetForTesting() {
  store.clear();
}
