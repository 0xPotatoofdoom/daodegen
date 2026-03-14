import {
  createWalletClient,
  http,
  type WalletClient,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getConfig, hasPrivateKey, getChain } from "./config.js";

let cachedJwt: string | undefined;
let jwtExpiresAt = 0;

// Cache for 23 hours (1h buffer before 24h JWT expiry)
const JWT_CACHE_MS = 23 * 60 * 60 * 1000;

let _account: PrivateKeyAccount | undefined;
let _walletClient: WalletClient | undefined;

function getAccount(): PrivateKeyAccount {
  if (_account) return _account;
  const config = getConfig();
  if (!config.DAODEGEN_PRIVATE_KEY) {
    throw new Error("DAODEGEN_PRIVATE_KEY is required for authenticated tools");
  }
  _account = privateKeyToAccount(config.DAODEGEN_PRIVATE_KEY as `0x${string}`);
  return _account;
}

function getWalletClient(): WalletClient {
  if (_walletClient) return _walletClient;
  const account = getAccount();
  const config = getConfig();
  _walletClient = createWalletClient({
    account,
    chain: getChain(),
    transport: http(config.DAODEGEN_RPC_URL),
  });
  return _walletClient;
}

/**
 * Returns a valid JWT, performing SIWE auth if needed.
 *
 * Flow: GET /api/auth/nonce -> construct SIWE message -> sign -> POST /api/auth/verify -> cache JWT
 */
export async function ensureJwt(): Promise<string> {
  if (!hasPrivateKey()) {
    throw new Error(
      "Set DAODEGEN_PRIVATE_KEY to enable authenticated tools",
    );
  }

  if (cachedJwt && Date.now() < jwtExpiresAt) {
    return cachedJwt;
  }

  const config = getConfig();
  const base = config.DAODEGEN_API_URL.replace(/\/$/, "");
  const account = getAccount();

  // 1. Get nonce
  const nonceRes = await fetch(`${base}/api/auth/nonce`);
  if (!nonceRes.ok) {
    throw new Error(`Failed to get nonce: HTTP ${nonceRes.status}`);
  }
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  // 2. Construct SIWE message
  const domain = new URL(base).host;
  const uri = base;
  const issuedAt = new Date().toISOString();
  const siweMessage = [
    `${domain} wants you to sign in with your Ethereum account:`,
    account.address,
    "",
    "Sign in to Dao DeGen Temple",
    "",
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${getChain().id}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");

  // 3. Sign
  const walletClient = getWalletClient();
  const signature = await walletClient.signMessage({
    account,
    message: siweMessage,
  });

  // 4. Verify and get JWT
  const verifyRes = await fetch(`${base}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: siweMessage, signature }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    throw new Error(`SIWE verify failed: HTTP ${verifyRes.status} - ${err}`);
  }

  const { token } = (await verifyRes.json()) as { token: string };

  cachedJwt = token;
  jwtExpiresAt = Date.now() + JWT_CACHE_MS;

  return token;
}

/**
 * Sign an x402 payment challenge.
 *
 * The challenge body from the 402 response contains the payment requirements.
 * We sign the exact payload the facilitator expects and return the header value.
 */
export async function signX402Payment(
  challenge: Record<string, unknown>,
): Promise<string> {
  const account = getAccount();
  const walletClient = getWalletClient();

  // The x402 protocol returns payment requirements in the 402 body.
  // We need to sign the payment authorization that the facilitator will verify.
  const paymentPayload = {
    ...challenge,
    payer: account.address,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const message = JSON.stringify(paymentPayload);
  const signature = await walletClient.signMessage({
    account,
    message,
  });

  // Return base64-encoded payment proof
  const proof = {
    payload: paymentPayload,
    signature,
  };

  return Buffer.from(JSON.stringify(proof)).toString("base64");
}
