/**
 * On-chain burn transaction verification.
 *
 * Verifies that a prayer_tx is a real, successful burn on the PrayerBurn
 * contract by fetching the receipt from the Unichain RPC and checking:
 *   1. Transaction exists and succeeded (status === "success")
 *   2. Transaction was sent to the PrayerBurn contract
 *   3. Receipt contains a Prayer event log from the contract
 *   4. The `from` address matches the authenticated wallet
 */

import { createPublicClient, http, decodeEventLog, type Hash, type Address } from "viem";
import { CONTRACT_ADDRESSES, PRAYER_BURN_ABI } from "@/lib/contracts";
import { chainConfig } from "@/lib/chain-config";
import { getRedis } from "@/lib/stores/redis";

const BURN_NULLIFIER_PREFIX = "burn-tx:";

const publicClient = createPublicClient({
  chain: {
    id: chainConfig.chainId,
    name: chainConfig.chainName,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  },
  transport: http(chainConfig.rpcUrl),
});

export type BurnVerifyResult =
  | { ok: true; burnAmount: bigint; sender: Address }
  | { ok: false; code: string };

/**
 * Verify a burn tx hash on-chain and return the result.
 */
export async function verifyBurnTx(
  txHash: Hash,
  expectedSender: Address
): Promise<BurnVerifyResult> {
  // 1. Fetch receipt
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return { ok: false, code: "BURN_TX_NOT_FOUND" };
  }

  // 2. Check success
  if (receipt.status !== "success") {
    return { ok: false, code: "BURN_TX_FAILED" };
  }

  // 3. Check contract address
  const prayerBurnAddress = CONTRACT_ADDRESSES.PRAYER_BURN.toLowerCase();
  if (receipt.to?.toLowerCase() !== prayerBurnAddress) {
    return { ok: false, code: "BURN_TX_WRONG_CONTRACT" };
  }

  // 4. Find Prayer event in logs
  let burnAmount: bigint | undefined;
  let eventSender: Address | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== prayerBurnAddress) continue;
    try {
      const decoded = decodeEventLog({
        abi: PRAYER_BURN_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Prayer") {
        const args = decoded.args as { sender: Address; amount: bigint; message: `0x${string}` };
        eventSender = args.sender;
        burnAmount = args.amount;
        break;
      }
    } catch {
      // Not a matching event, skip
    }
  }

  if (burnAmount === undefined || !eventSender) {
    return { ok: false, code: "BURN_TX_NO_EVENT" };
  }

  // 5. Check sender matches authenticated wallet
  if (eventSender.toLowerCase() !== expectedSender.toLowerCase()) {
    return { ok: false, code: "BURN_TX_WRONG_SENDER" };
  }

  return { ok: true, burnAmount, sender: eventSender };
}

/**
 * Check if a burn tx hash has already been used (replay protection).
 */
export async function isBurnTxUsed(txHash: string): Promise<boolean> {
  const redis = getRedis();
  const val = await redis.get(BURN_NULLIFIER_PREFIX + txHash);
  return val !== null;
}

/**
 * Mark a burn tx hash as used (permanent — no TTL).
 */
export async function markBurnTxUsed(txHash: string): Promise<void> {
  const redis = getRedis();
  await redis.set(BURN_NULLIFIER_PREFIX + txHash, String(Date.now()));
}
