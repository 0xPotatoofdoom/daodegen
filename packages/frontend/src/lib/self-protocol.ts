/**
 * Self Protocol integration — ZK identity verification for anonymous prayer.
 *
 * Self Protocol lets users prove attributes (humanity, age, nationality)
 * from government-issued IDs using zk-SNARKs, without revealing personal data.
 *
 * For daodegen: a user proves they are a valid human who made a DAODEGEN burn,
 * without linking their full wallet history to their prayer content.
 *
 * Architecture:
 *   - Frontend: generates Self QR code / universal link for user verification
 *   - Backend: SelfBackendVerifier validates the ZK proof off-chain
 *   - On-chain: AnonymousPrayer contract records nullifier (no wallet link)
 *
 * Self Protocol Hub V2 is deployed on Celo. Backend verification works
 * cross-chain since it verifies proofs against Celo's Hub directly.
 */

import {
  SelfBackendVerifier,
  DefaultConfigStore,
  AllIds,
} from "@selfxyz/core";
import type {
  AttestationId,
  VerificationResult,
} from "@selfxyz/core";
import { randomUUID } from "crypto";
import { reqLogger } from "./logger";

// --- Configuration ---

const SELF_SCOPE = "daodegen-anonymous-prayer";

/**
 * Endpoint type for Self Protocol verification.
 * "staging_https" = backend verification (off-chain, works cross-chain)
 * "staging_celo"  = on-chain verification on Celo Sepolia
 * "celo"          = on-chain verification on Celo mainnet
 */
const ENDPOINT_TYPE = "staging_https" as const;

// --- Backend Verifier (singleton) ---

let _verifier: SelfBackendVerifier | null = null;

function getVerifier(): SelfBackendVerifier {
  if (_verifier) return _verifier;

  const endpoint =
    process.env.NEXT_PUBLIC_SELF_ENDPOINT ??
    process.env.SELF_VERIFY_ENDPOINT ??
    "https://daodegen.com/v1/sermon/anonymous/callback";

  // In staging/testnet mode, use mock passports for testing
  const isMockPassport =
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN !== "mainnet";

  _verifier = new SelfBackendVerifier(
    SELF_SCOPE,
    endpoint,
    isMockPassport,
    AllIds,
    new DefaultConfigStore({
      // Minimal config: just prove you're human (no age/country restrictions)
      // The temple does not discriminate — all seekers are welcome
    }),
    "hex" // userIdType: Ethereum hex addresses
  );

  return _verifier;
}

// --- Proof Verification ---

export interface SelfProofPayload {
  attestationId: AttestationId;
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicSignals: string[];
  userContextData?: string;
}

export interface AnonymousVerificationResult {
  verified: boolean;
  nullifier: string | null;
  error?: string;
}

/**
 * Verify a Self Protocol ZK proof submitted with an anonymous prayer.
 * Returns the nullifier if valid (used to prevent proof replay).
 */
export async function verifySelfProof(
  payload: SelfProofPayload
): Promise<AnonymousVerificationResult> {
  const log = reqLogger("self-protocol");

  try {
    const verifier = getVerifier();
    const result: VerificationResult = await verifier.verify(
      payload.attestationId,
      payload.proof,
      payload.publicSignals,
      payload.userContextData ?? ""
    );

    if (!result.isValidDetails.isValid) {
      log.warn({ details: result.isValidDetails }, "Self proof invalid");
      return {
        verified: false,
        nullifier: null,
        error: "ZK proof verification failed",
      };
    }

    log.info(
      { nullifier: result.discloseOutput.nullifier },
      "Self proof verified — anonymous prayer authorized"
    );

    return {
      verified: true,
      nullifier: result.discloseOutput.nullifier,
    };
  } catch (err) {
    log.error({ err }, "Self proof verification error");
    return {
      verified: false,
      nullifier: null,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}

// --- Frontend QR Code Config ---

const SELF_REDIRECT_URL = "https://redirect.self.xyz";

/**
 * Build the Self app configuration for generating a QR code / universal link.
 * The user scans this with the Self mobile app to generate a ZK proof.
 *
 * Uses the SelfApp format expected by the Self mobile app. The config is
 * serialized as JSON and passed via the redirect URL query parameter.
 */
export function buildSelfAppConfig(userId: string) {
  const endpoint =
    process.env.NEXT_PUBLIC_SELF_ENDPOINT ??
    "https://daodegen.com/v1/sermon/anonymous/callback";

  // Strip 0x prefix — Self expects bare hex for userId
  const bareUserId = userId.startsWith("0x") ? userId.slice(2) : userId;

  return {
    sessionId: randomUUID(),
    version: 2,
    appName: "Dao DeGen Temple",
    scope: SELF_SCOPE,
    endpoint,
    endpointType: ENDPOINT_TYPE,
    userId: bareUserId,
    userIdType: "hex",
    userDefinedData: "",
    disclosures: {},
    logoBase64: "",
    deeplinkCallback: "",
    header: "",
    devMode: false,
    chainID: 42220, // Celo (Self Hub V2 chain)
  };
}

/**
 * Generate a Self Protocol universal link for the given user.
 * This link opens the Self mobile app for ZK proof generation.
 */
export function getSelfUniversalLink(userId: string): string {
  const config = buildSelfAppConfig(userId);
  return `${SELF_REDIRECT_URL}?selfApp=${encodeURIComponent(JSON.stringify(config))}`;
}

// --- Nullifier tracking (Redis — permanent, survives restarts) ---

import { getRedis } from "./stores/redis";

const _nullifierRedis = getRedis();

export async function isNullifierUsed(nullifier: string): Promise<boolean> {
  const exists = await _nullifierRedis.exists(`nullifier:${nullifier}`);
  return exists === 1;
}

export async function markNullifierUsed(nullifier: string): Promise<void> {
  // SET NX — no TTL, nullifiers must never be reused
  await _nullifierRedis.set(`nullifier:${nullifier}`, "1", "NX");
}

export { SELF_SCOPE };
