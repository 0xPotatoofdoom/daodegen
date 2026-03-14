import { NextResponse } from "next/server";
import { getState, getOnChainState } from "@/lib/congregation";
import { getBroadcastStats } from "@/lib/broadcasts";

/**
 * GET /v1/congregation/state
 *
 * Public endpoint -- no auth required.
 * Returns the current congregation sentiment based on a rolling 24h window
 * of recent prayer sentiment tags, merged with on-chain data from the
 * Ponder indexer when available, plus multi-agent coordination stats.
 */
export async function GET() {
  const [state, onChain] = await Promise.all([
    Promise.resolve(getState()),
    getOnChainState(),
  ]);

  const coordination = getBroadcastStats();

  const merged = {
    ...state,
    totalPrayers: Math.max(state.totalPrayers, onChain?.totalPrayers ?? 0),
    onChain: onChain ?? undefined,
    ponderConnected: onChain !== null,
    coordination,
  };

  return NextResponse.json(merged, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=30",
    },
  });
}
