export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { jwtVerify } from "jose";
import { x402Server, PAY_TO, USDC_NETWORK, PRICE_LOOKUP } from "@/lib/x402";
import { getVerseById } from "@/lib/verses";
import { llm, LookupResponse } from "@/lib/llm";
import { env } from "@/lib/env";
import { reqLogger } from "@/lib/logger";
import { apiError, Errors, getTraceId } from "@/lib/errors";

const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);

const handler = async (req: NextRequest) => {
  const traceId = getTraceId(req);
  const log = reqLogger('verse-lookup', traceId);
  log.info('Lookup requested');

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

  let body: { verse?: number };
  try {
    body = await req.json();
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId);
  }

  const verseId = body.verse;
  if (!verseId || typeof verseId !== "number" || verseId < 1 || verseId > 81) {
    return apiError(400, Errors.VERSE_INVALID_ID, undefined, undefined, traceId);
  }

  const verse = getVerseById(verseId);
  if (!verse) {
    return apiError(404, Errors.VERSE_NOT_FOUND, undefined, undefined, traceId);
  }

  let interpretation;
  try {
    interpretation = await llm.generateInterpretation(verse);
  } catch (err) {
    log.error({ err, verseId }, 'Lookup LLM call failed');
    return apiError(500, Errors.INTERNAL_ERROR, { operation: "interpretation" }, undefined, traceId);
  }

  const response: LookupResponse = {
    verse: verse.id,
    title: verse.title,
    text: verse.body,
    interpretation,
  };

  log.info({ verseId }, 'Lookup complete');
  return NextResponse.json(response);
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://daodegen.com";

export const POST = withX402<unknown>(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: PRICE_LOOKUP,
      network: USDC_NETWORK,
      payTo: PAY_TO,
    },
    description: "Verse lookup with base interpretation",
    resource: `${SITE_URL}/v1/verse/lookup/`,
  },
  x402Server,
);
