import { NextRequest, NextResponse } from "next/server";
import { llm, SermonRequest, SermonResponse, PrayerType } from "@/lib/llm";
import { sanitizeInput } from "@/lib/llm";
import { verses } from "@/lib/verses";
import { getSummary, SentimentTag } from "@/lib/congregation";
import { generateFallbackSermon } from "@/lib/fallback";
import { reqLogger } from "@/lib/logger";
import { apiError, Errors, getTraceId } from "@/lib/errors";
import {
  verifySelfProof,
  isNullifierUsed,
  markNullifierUsed,
  type SelfProofPayload,
} from "@/lib/self-protocol";

const VALID_PRAYER_TYPES: PrayerType[] = [
  "prayer",
  "confession",
  "question",
  "silent",
  "offering",
];

// Per-nullifier cooldown to prevent rapid resubmission
const NULLIFIER_COOLDOWN_MS = 60_000;
const nullifierLastSermon = new Map<string, number>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - NULLIFIER_COOLDOWN_MS * 2;
  for (const [nul, ts] of nullifierLastSermon) {
    if (ts < cutoff) nullifierLastSermon.delete(nul);
  }
}, 5 * 60_000);

/**
 * POST /v1/sermon/anonymous
 *
 * Submit an anonymous prayer using a Self Protocol ZK proof.
 * No wallet address is logged. No JWT required.
 * The ZK proof IS the authentication.
 *
 * Body: {
 *   proof: SelfProofPayload,   // Self Protocol ZK proof
 *   message: string,           // prayer text
 *   prayer_type: string,       // prayer | confession | question | silent | offering
 *   burn_amount: string        // claimed burn amount (not verified on-chain for anon)
 * }
 *
 * Response: { sermon: SermonResponse }
 */
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  const log = reqLogger("sermon-anonymous", traceId);

  // --- Parse body ---
  let body: {
    proof?: SelfProofPayload;
    message?: string;
    prayer_type?: string;
    burn_amount?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId);
  }

  // --- Validate proof payload ---
  if (!body.proof || !body.proof.attestationId || !body.proof.proof || !body.proof.publicSignals) {
    return apiError(400, Errors.ANON_INVALID_PROOF, { hint: "Generate a proof using the Self mobile app" }, undefined, traceId);
  }

  const prayerType = body.prayer_type as PrayerType;
  if (!prayerType || !VALID_PRAYER_TYPES.includes(prayerType)) {
    return apiError(400, Errors.SERMON_INVALID_PRAYER, { valid: VALID_PRAYER_TYPES }, undefined, traceId);
  }

  // --- Verify the ZK proof ---
  const verification = await verifySelfProof(body.proof);

  if (!verification.verified || !verification.nullifier) {
    log.warn({ error: verification.error }, "Anonymous prayer proof rejected");
    return apiError(403, Errors.ANON_INVALID_PROOF, { reason: verification.error }, undefined, traceId);
  }

  const { nullifier } = verification;

  // --- Check nullifier replay ---
  if (isNullifierUsed(nullifier)) {
    return apiError(409, Errors.ANON_NULLIFIER_USED, undefined, undefined, traceId);
  }

  // --- Nullifier cooldown ---
  const now = Date.now();
  const lastSermon = nullifierLastSermon.get(nullifier);
  if (lastSermon && now - lastSermon < NULLIFIER_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (NULLIFIER_COOLDOWN_MS - (now - lastSermon)) / 1000
    );
    return apiError(429, Errors.SERMON_COOLDOWN, { retryAfter }, { "Retry-After": String(retryAfter) }, traceId);
  }

  // --- Generate sermon (anonymous — no sender address) ---
  const rawBurn = body.burn_amount ?? "0";
  const burnAmount = /^\d+(\.\d+)?$/.test(rawBurn) ? rawBurn : "0";
  const message = body.message ?? "";
  const congregationState = getSummary();
  const safeMessage = sanitizeInput(message, 1024);

  const request: SermonRequest = {
    message: safeMessage,
    sender: "anonymous", // No wallet address — this is the point
    prayerType,
    burnAmount,
    congregationState,
  };

  let sermon: SermonResponse;
  try {
    sermon = await llm.generateSermon(verses, request);
  } catch (err) {
    log.error({ err }, "Anonymous sermon generation failed, using fallback");
    sermon = generateFallbackSermon(safeMessage, verses);
  }

  // Mark nullifier as used and record cooldown
  markNullifierUsed(nullifier);
  nullifierLastSermon.set(nullifier, Date.now());

  // Record prayer with "anonymous" sender — sentiment is still tracked
  // but no wallet address is ever associated
  const { recordPrayer } = await import("@/lib/congregation");
  recordPrayer("anonymous", sermon.sentiment_tag as SentimentTag);

  log.info("Anonymous sermon delivered via Self Protocol ZK proof");

  return NextResponse.json({
    sermon,
    anonymous: true,
    privacy: "Self Protocol ZK proof verified — no wallet identity recorded",
  });
}
