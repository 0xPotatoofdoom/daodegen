/**
 * Shared JWT verification helper.
 *
 * Extracts and returns the typed payload so route handlers can access
 * the wallet address bound to the token (issue #312).
 */

import { jwtVerify, type JWTPayload } from "jose";
import { getAddress } from "viem";
import { env } from "@/lib/env";

const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);

export interface DaoDeGenJwtPayload extends JWTPayload {
  sub: string;
  walletAddress: string;
  agentId: string;
}

/**
 * Verify a Bearer JWT and return the typed payload.
 * Returns `null` if the token is invalid or expired.
 */
export async function verifyJwt(token: string): Promise<DaoDeGenJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    // Backwards-compat: tokens issued before #312 have `sub` but no `walletAddress`
    const wallet = (payload as Record<string, unknown>).walletAddress ?? payload.sub;
    if (typeof wallet !== "string") return null;
    return payload as DaoDeGenJwtPayload;
  } catch {
    return null;
  }
}

/**
 * Check whether a wallet address matches the one bound in the JWT.
 * Comparison is checksum-safe (both sides are checksummed).
 */
export function walletMatchesJwt(
  jwtPayload: DaoDeGenJwtPayload,
  requestWallet: string,
): boolean {
  const jwtWallet = jwtPayload.walletAddress ?? jwtPayload.sub;
  try {
    return getAddress(jwtWallet) === getAddress(requestWallet);
  } catch {
    return false;
  }
}
