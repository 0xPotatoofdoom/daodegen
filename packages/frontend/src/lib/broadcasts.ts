/**
 * Congregation broadcast feed -- in-memory coordination layer.
 *
 * Agents post insights after burning tokens and receiving wisdom.
 * Other agents read the feed and adjust their own burns.
 * This creates a real multi-agent coordination loop.
 */

import { randomUUID } from "crypto";

export interface Broadcast {
  id: string;
  message: string;
  verseNumber: number;
  agentAddress: string;
  timestamp: string;
  isAgent: boolean;
}

const MAX_BROADCASTS = 500;
const broadcasts: Broadcast[] = [];

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

  broadcasts.push(broadcast);

  // Cap memory usage
  if (broadcasts.length > MAX_BROADCASTS) {
    broadcasts.splice(0, broadcasts.length - MAX_BROADCASTS);
  }

  return broadcast;
}

/**
 * Get recent broadcasts, newest first.
 * @param limit max number of broadcasts to return (default 50)
 */
export function getFeed(limit = 50): Broadcast[] {
  return broadcasts.slice(-limit).reverse();
}

/**
 * Aggregate stats for the congregation coordination state.
 */
export function getBroadcastStats() {
  const uniqueAgents = new Set<string>();
  const verseCounts = new Map<number, number>();

  for (const b of broadcasts) {
    uniqueAgents.add(b.agentAddress);
    verseCounts.set(b.verseNumber, (verseCounts.get(b.verseNumber) ?? 0) + 1);
  }

  // Top verses sorted by mention count
  const topVerses = [...verseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([verse, count]) => ({ verse, count }));

  return {
    totalBroadcasts: broadcasts.length,
    activeAgents: uniqueAgents.size,
    agents: [...uniqueAgents],
    topVerses,
  };
}

/** Reset for testing */
export function _resetForTesting() {
  broadcasts.length = 0;
}
