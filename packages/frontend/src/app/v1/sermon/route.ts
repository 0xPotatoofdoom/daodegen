import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, keccak256, toHex, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "@/lib/env";
import { chainConfig } from "@/lib/chain-config";
import { apiError, Errors, getTraceId } from "@/lib/errors";
import { verifyJwt, walletMatchesJwt } from "@/lib/jwt";
import { llm, SermonRequest, SermonResponse, PrayerType } from "@/lib/llm";
import { sanitizeInput } from "@/lib/llm";
import { verses } from "@/lib/verses";
import { recordPrayer, getSummary, SentimentTag } from "@/lib/congregation";
import { generateFallbackSermon } from "@/lib/fallback";
import { fetchPrayerByTxHash } from "@/lib/ponder";
import { verifyBurnTx, isBurnTxUsed, markBurnTxUsed } from "@/lib/verify-burn";
import { reqLogger } from "@/lib/logger";

const SERMON_COMMITMENT_ABI = parseAbi([
  "function fulfill(bytes32 commitmentId, bytes32 wisdomHash) external",
]);

const SERMON_COMMITMENT_ADDRESS = process.env
  .NEXT_PUBLIC_SERMON_COMMITMENT_ADDRESS as `0x${string}` | undefined;
const PASTOR_PRIVATE_KEY = process.env.PASTOR_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

const WALLET_COOLDOWN_MS = 60_000;
const WALLET_COOLDOWN_S = Math.ceil(WALLET_COOLDOWN_MS / 1000);

// Sermon cooldown — Redis is the source of truth (TTL handles cleanup)
import { getRedis } from "@/lib/stores/redis";
const _sermonRedis = getRedis();
const COOLDOWN_PREFIX = "sermon-cooldown:";

async function getWalletCooldown(wallet: string): Promise<number | null> {
  const val = await _sermonRedis.get(COOLDOWN_PREFIX + wallet);
  return val ? Number(val) : null;
}

async function setWalletCooldown(wallet: string): Promise<void> {
  await _sermonRedis.set(COOLDOWN_PREFIX + wallet, String(Date.now()), "EX", WALLET_COOLDOWN_S * 2);
}
const VALID_PRAYER_TYPES: PrayerType[] = [
  "prayer",
  "confession",
  "question",
  "silent",
  "offering",
];
/**
 * POST /v1/sermon
 *
 * Submit a prayer and receive a sermon response.
 *
 * Auth: JWT (SIWE) -- Bearer token in Authorization header.
 * No x402 payment -- the token burn IS the payment.
 *
 * Body: {
 *   prayer_tx: string,    // tx hash of the on-chain pray() call
 *   message: string,      // prayer text (can be empty for silent burns)
 *   sender: string,       // wallet address
 *   prayer_type: string,  // prayer | confession | question | silent | offering
 *   burn_amount: string   // amount burned (human-readable, e.g. "100")
 *   commitment_id?: string // optional SermonCommitment escrow id (bytes32 hex)
 * }
 *
 * Response: { sermon: SermonResponse }
 */
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  const log = reqLogger("sermon", traceId);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return apiError(401, Errors.AUTH_MISSING_TOKEN, undefined, undefined, traceId);
  }
  const token = authHeader.split(" ")[1];
  const jwtPayload = await verifyJwt(token);
  if (!jwtPayload) {
    return apiError(401, Errors.AUTH_INVALID_TOKEN, undefined, undefined, traceId);
  }
  let body: {
    prayer_tx?: string;
    message?: string;
    sender?: string;
    prayer_type?: string;
    burn_amount?: string;
    commitment_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId);
  }
  const senderAddress = body.sender?.toLowerCase();
  if (!senderAddress || !/^0x[a-f0-9]{40}$/.test(senderAddress)) {
    return apiError(400, Errors.SERMON_INVALID_SENDER, undefined, undefined, traceId);
  }
  // Issue #312: verify sender matches the wallet bound in the JWT
  if (!walletMatchesJwt(jwtPayload, senderAddress)) {
    return apiError(403, Errors.AUTH_WALLET_MISMATCH, undefined, undefined, traceId);
  }
  const prayerTx = body.prayer_tx?.toLowerCase();
  if (!prayerTx || !/^0x[a-f0-9]{64}$/.test(prayerTx)) {
    return apiError(400, Errors.INVALID_BODY, { field: "prayer_tx", expected: "0x-prefixed 64-char hex" }, undefined, traceId);
  }
  const prayerType = body.prayer_type as PrayerType;
  if (!prayerType || !VALID_PRAYER_TYPES.includes(prayerType)) {
    return apiError(400, Errors.SERMON_INVALID_PRAYER, { valid: VALID_PRAYER_TYPES }, undefined, traceId);
  }
  // --- Burn tx replay check ---
  if (await isBurnTxUsed(prayerTx)) {
    return apiError(409, Errors.BURN_TX_ALREADY_USED, undefined, undefined, traceId);
  }

  // --- On-chain burn verification ---
  const burnResult = await verifyBurnTx(
    prayerTx as `0x${string}`,
    senderAddress as `0x${string}`
  );
  if (!burnResult.ok) {
    return apiError(400, Errors[burnResult.code as keyof typeof Errors], undefined, undefined, traceId);
  }

  const rawBurn = body.burn_amount ?? "0";
  const burnAmount = /^\d+(\.\d+)?$/.test(rawBurn) ? rawBurn : "0";
  const message = body.message ?? "";
  const now = Date.now();
  const lastSermon = await getWalletCooldown(senderAddress);
  if (lastSermon && now - lastSermon < WALLET_COOLDOWN_MS) {
    const retryAfter = Math.ceil((WALLET_COOLDOWN_MS - (now - lastSermon)) / 1000);
    return apiError(429, Errors.SERMON_COOLDOWN, { retryAfter }, { "Retry-After": String(retryAfter) }, traceId);
  }
  const congregationState = getSummary();
  const safeMessage = sanitizeInput(message, 1024);
  const request: SermonRequest = {
    message: safeMessage,
    sender: senderAddress,
    prayerType,
    burnAmount,
    congregationState,
  };
  let sermon: SermonResponse;
  try {
    sermon = await llm.generateSermon(verses, request);
  } catch (err) {
    log.error({ err }, 'Sermon generation failed, using fallback');
    sermon = generateFallbackSermon(safeMessage, verses);
  }
  await setWalletCooldown(senderAddress);
  await markBurnTxUsed(prayerTx);
  recordPrayer(senderAddress, sermon.sentiment_tag as SentimentTag);

  // ---Get Prayer ID from Ponder indexer (retry up to 3x — indexer may lag a few seconds)---
  let prayer = await fetchPrayerByTxHash(prayerTx, senderAddress);
  if (!prayer) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      prayer = await fetchPrayerByTxHash(prayerTx, senderAddress);
      if (prayer) break;
    }
  }

  // --- Fulfill sermon commitment on-chain (if commitment_id provided) ---
  let fulfillTx: string | undefined;
  const commitmentId = body.commitment_id;
  if (
    commitmentId &&
    /^0x[a-f0-9]{64}$/i.test(commitmentId) &&
    SERMON_COMMITMENT_ADDRESS &&
    PASTOR_PRIVATE_KEY
  ) {
    try {
      const wisdomHash = keccak256(toHex(sermon.content));
      const account = privateKeyToAccount(PASTOR_PRIVATE_KEY);
      const walletClient = createWalletClient({
        account,
        chain: {
          id: chainConfig.chainId,
          name: chainConfig.chainName,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
        },
        transport: http(chainConfig.rpcUrl),
      });

      fulfillTx = await walletClient.writeContract({
        address: SERMON_COMMITMENT_ADDRESS,
        abi: SERMON_COMMITMENT_ABI,
        functionName: "fulfill",
        args: [commitmentId as `0x${string}`, wisdomHash],
      });
    } catch (err) {
      log.error({ err, commitmentId }, "Failed to fulfill sermon commitment on-chain");
      // Non-fatal: still return the sermon even if on-chain fulfill fails
    }
  }

  return NextResponse.json({
    sermon,
    prayerId: prayer?.id ?? null,
    ...(fulfillTx ? { fulfill_tx: fulfillTx } : {}),
  });
}
