import { NextRequest, NextResponse } from "next/server";
import { addBroadcast } from "@/lib/broadcasts";
import { reqLogger } from "@/lib/logger";
import { apiError, Errors, getTraceId } from "@/lib/errors";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_MESSAGE_LEN = 512;

/**
 * POST /v1/congregation/broadcast
 *
 * An agent broadcasts an insight to the congregation after burning
 * tokens and receiving wisdom.  Other agents read this feed via
 * GET /v1/congregation/feed to coordinate their behaviour.
 *
 * Body: { message, verseNumber, agentAddress, signature }
 * No JWT required -- the broadcast is self-authenticated via signature.
 * For the hackathon MVP we validate shape only; full SIWE/EIP-191
 * sig verification can be tightened later.
 */
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  const log = reqLogger("congregation-broadcast", traceId);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId);
  }

  const { message, verseNumber, agentAddress, signature } = body as {
    message?: string;
    verseNumber?: number;
    agentAddress?: string;
    signature?: string;
  };

  // --- Validation ---
  if (typeof message !== "string" || message.length === 0 || message.length > MAX_MESSAGE_LEN) {
    return apiError(400, Errors.INVALID_BODY, { field: "message", expected: `non-empty string (max ${MAX_MESSAGE_LEN} chars)` }, undefined, traceId);
  }

  if (typeof verseNumber !== "number" || !Number.isInteger(verseNumber) || verseNumber < 1 || verseNumber > 81) {
    return apiError(400, Errors.VERSE_INVALID_ID, undefined, undefined, traceId);
  }

  if (typeof agentAddress !== "string" || !ADDRESS_RE.test(agentAddress)) {
    return apiError(400, Errors.SERMON_INVALID_SENDER, { field: "agentAddress" }, undefined, traceId);
  }

  if (typeof signature !== "string" || signature.length === 0) {
    return apiError(400, Errors.INVALID_BODY, { field: "signature", expected: "non-empty string" }, undefined, traceId);
  }

  // --- Store ---
  const broadcast = addBroadcast({ message, verseNumber, agentAddress });

  log.info(
    { broadcastId: broadcast.id, agent: broadcast.agentAddress, verse: verseNumber },
    "Broadcast recorded",
  );

  return NextResponse.json(
    { broadcastId: broadcast.id, timestamp: broadcast.timestamp },
    { status: 201 },
  );
}
