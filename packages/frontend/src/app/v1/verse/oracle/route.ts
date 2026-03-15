export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { jwtVerify } from "jose";
import { x402Server, PAY_TO, USDC_NETWORK, PRICE_ORACLE } from "@/lib/x402";
import { verses } from "@/lib/verses";
import { getVerseById } from "@/lib/verses";
import { llm, OracleResponse } from "@/lib/llm";
import { env } from "@/lib/env";
import { reqLogger } from "@/lib/logger";
import { apiError, Errors, getTraceId } from "@/lib/errors";

const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);

const handler = async (req: NextRequest) => {
  const traceId = getTraceId(req);
  const log = reqLogger('verse-oracle', traceId);
  log.info('Oracle reading requested');

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return apiError(401, Errors.AUTH_MISSING_TOKEN, undefined, undefined, traceId);
  }

  const token = authHeader.split(" ")[1];
  try {
    await jwtVerify(token, SECRET_KEY);
  } catch {
    return apiError(401, Errors.AUTH_INVALID_TOKEN, undefined, undefined, traceId);
  }

  let body: { state?: string };
  try {
    body = await req.json();
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId);
  }

  if (!body.state || typeof body.state !== "string" || !body.state.trim()) {
    return apiError(400, Errors.INVALID_BODY, { field: "state", expected: "non-empty string" }, undefined, traceId);
  }

  let oracleResult;
  try {
    oracleResult = await llm.generateOracleReading(verses, body.state);
  } catch (err) {
    log.error({ err }, 'Oracle LLM call failed');
    return apiError(500, Errors.INTERNAL_ERROR, { operation: "oracle_reading" }, undefined, traceId);
  }

  const { verseId, reading, reasoning } = oracleResult;

  const verse = getVerseById(verseId);
  if (!verse) {
    log.error({ verseId }, 'Oracle returned invalid verse ID');
    return apiError(500, Errors.INTERNAL_ERROR, { operation: "oracle_verse_selection", verseId }, undefined, traceId);
  }

  const response: OracleResponse = {
    recommended_verse: verse.id,
    title: verse.title,
    text: verse.body,
    oracle_reading: reading,
    reasoning,
  };

  log.info({ verseId: verse.id }, 'Oracle reading complete');
  return NextResponse.json(response);
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://daodegen.com";

export const POST = withX402<unknown>(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: PRICE_ORACLE,
      network: USDC_NETWORK,
      payTo: PAY_TO,
    },
    description: "Verse oracle reading",
    resource: `${SITE_URL}/v1/verse/oracle/`,
  },
  x402Server,
);
