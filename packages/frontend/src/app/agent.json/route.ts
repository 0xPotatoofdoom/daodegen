import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * GET /agent.json
 *
 * Serves the agent.json manifest for Protocol Labs ERC-8004 track discovery.
 * Reads from the repo root agent.json at build/request time.
 */
export async function GET() {
  const agentJsonPath = join(process.cwd(), "..", "..", "agent.json");
  const content = JSON.parse(readFileSync(agentJsonPath, "utf-8"));

  return NextResponse.json(content, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
