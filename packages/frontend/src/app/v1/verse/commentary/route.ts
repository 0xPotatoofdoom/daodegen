export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { jwtVerify } from "jose";
import { x402Server, PAY_TO, USDC_NETWORK, PRICE_COMMENTARY } from "@/lib/x402";
import { getVerseById } from "@/lib/verses";
import { llm, CommentaryResponse } from "@/lib/llm";
import { env } from "@/lib/env";
import { reqLogger } from "@/lib/logger";
import { apiError, Errors, getTraceId } from "@/lib/errors";

const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);

const handler = async (req: NextRequest) => {
  const traceId = getTraceId(req);
  const log = reqLogger('verse-commentary', traceId);
  log.info('Commentary requested');

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

  let body: { verse?: number; context?: string };
  try {
    body = await req.json();
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId);
  }

  const verseId = body.verse;
  if (!verseId || typeof verseId !== "number" || verseId < 1 || verseId > 81) {
    return apiError(400, Errors.VERSE_INVALID_ID, undefined, undefined, traceId);
  }

  if (!body.context || typeof body.context !== "string" || !body.context.trim()) {
    return apiError(400, Errors.INVALID_BODY, { field: "context", expected: "non-empty string" }, undefined, traceId);
  }

  const verse = getVerseById(verseId);
  if (!verse) {
    return apiError(404, Errors.VERSE_NOT_FOUND, undefined, undefined, traceId);
  }

  let commentary;
  try {
    commentary = await llm.generateCommentary(verse, body.context);
  } catch (err) {
    log.error({ err, verseId }, 'Commentary LLM call failed');
    return apiError(500, Errors.INTERNAL_ERROR, { operation: "commentary" }, undefined, traceId);
  }

  const response: CommentaryResponse = {
    verse: verse.id,
    title: verse.title,
    text: verse.body,
    commentary,
    context_applied: body.context,
  };

  log.info({ verseId }, 'Commentary complete');
  return NextResponse.json(response);
};

export const POST = withX402<unknown>(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: PRICE_COMMENTARY,
      network: USDC_NETWORK,
      payTo: PAY_TO,
    },
    description: "Contextual verse commentary",
  },
  x402Server,
);
