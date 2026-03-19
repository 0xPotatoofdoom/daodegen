/**
 * Structured API error catalog.
 *
 * Every API route should use `apiError()` instead of ad-hoc
 * `NextResponse.json({ error: "..." })` calls. This gives agents
 * machine-readable error codes they can switch on.
 */

import { NextRequest, NextResponse } from "next/server";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── Error Catalog ─────────────────────────────────────────────────

export const Errors = {
  // Auth
  AUTH_MISSING_TOKEN: {
    code: "AUTH_MISSING_TOKEN",
    message: "Authorization header with Bearer token is required",
  },
  AUTH_INVALID_TOKEN: {
    code: "AUTH_INVALID_TOKEN",
    message: "JWT token is invalid or expired",
  },
  AUTH_NOT_AGENT: {
    code: "AUTH_NOT_AGENT",
    message: "Address is not a registered Agent (EIP-8004)",
  },

  // Verse
  VERSE_INVALID_ID: {
    code: "VERSE_INVALID_ID",
    message: "Verse number must be an integer between 1 and 81",
  },
  VERSE_NOT_FOUND: {
    code: "VERSE_NOT_FOUND",
    message: "Verse not found",
  },

  // Sermon
  SERMON_COOLDOWN: {
    code: "SERMON_COOLDOWN",
    message: "Please wait before requesting another sermon",
  },
  SERMON_INVALID_PRAYER: {
    code: "SERMON_INVALID_PRAYER",
    message: "Invalid prayer type",
  },
  SERMON_INVALID_SENDER: {
    code: "SERMON_INVALID_SENDER",
    message: "Invalid sender address",
  },
  SERMON_GENERATION_FAILED: {
    code: "SERMON_GENERATION_FAILED",
    message: "Sermon generation failed",
  },

  // General
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many requests",
  },
  INVALID_BODY: {
    code: "INVALID_BODY",
    message: "Request body is invalid or missing required fields",
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  },
  METHOD_NOT_ALLOWED: {
    code: "METHOD_NOT_ALLOWED",
    message: "HTTP method not allowed",
  },

  // Congregation
  CONGREGATION_UNAVAILABLE: {
    code: "CONGREGATION_UNAVAILABLE",
    message: "Congregation state is unavailable",
  },

  // Anonymous prayer
  ANON_INVALID_PROOF: {
    code: "ANON_INVALID_PROOF",
    message: "Self Protocol proof is invalid or expired",
  },
  ANON_NULLIFIER_USED: {
    code: "ANON_NULLIFIER_USED",
    message: "This nullifier has already been used",
  },

  // Burn verification
  BURN_TX_NOT_FOUND: {
    code: "BURN_TX_NOT_FOUND",
    message: "Burn transaction not found or has not been mined",
  },
  BURN_TX_FAILED: {
    code: "BURN_TX_FAILED",
    message: "Burn transaction reverted on-chain",
  },
  BURN_TX_WRONG_CONTRACT: {
    code: "BURN_TX_WRONG_CONTRACT",
    message: "Transaction was not sent to the PrayerBurn contract",
  },
  BURN_TX_NO_EVENT: {
    code: "BURN_TX_NO_EVENT",
    message: "Transaction does not contain a PrayerBurned event",
  },
  BURN_TX_WRONG_SENDER: {
    code: "BURN_TX_WRONG_SENDER",
    message: "Burn transaction sender does not match authenticated wallet",
  },
  BURN_TX_ALREADY_USED: {
    code: "BURN_TX_ALREADY_USED",
    message: "This burn transaction has already been used for a sermon",
  },
} as const;

export type ErrorCode = keyof typeof Errors;

/** Extract the trace ID from the request (set by middleware). */
export function getTraceId(req: NextRequest): string {
  return req.headers.get("x-request-id") || "";
}

// ─── Helper ────────────────────────────────────────────────────────

type ErrorDef = (typeof Errors)[keyof typeof Errors];

/**
 * Build a structured error response.
 * If a traceId is provided (from x-request-id header), it's included in the
 * error body so agents can reference it when reporting issues.
 */
export function apiError(
  status: number,
  error: ErrorDef,
  details?: unknown,
  headers?: Record<string, string>,
  traceId?: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        ...error,
        ...(details !== undefined && { details }),
        ...(traceId && { traceId }),
      },
    },
    { status, headers }
  );
}
