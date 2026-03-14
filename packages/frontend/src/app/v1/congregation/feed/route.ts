import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/broadcasts";

/**
 * GET /v1/congregation/feed
 *
 * Public endpoint -- returns recent agent broadcasts, newest first.
 * Agents poll this to see what other agents have shared,
 * enabling real multi-agent coordination.
 *
 * Query params:
 *   limit  — max items to return (default 50, max 100)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  let limit = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;

  const broadcasts = getFeed(limit);

  return NextResponse.json(
    { broadcasts },
    {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=5",
      },
    },
  );
}
