/**
 * x402 E2E payment client -- constructs payment headers using viem directly.
 *
 * We bypass the @x402/core client SDK here because those packages are ESM-only
 * and Playwright's test runner can't dynamically import them. Instead we
 * construct the EIP-3009 TransferWithAuthorization signature and the
 * PAYMENT-SIGNATURE header manually -- the format is well-defined.
 *
 * Requires E2E_PAYER_PRIVATE_KEY env var (wallet funded with USDC on Unichain Sepolia).
 */
import { privateKeyToAccount } from 'viem/accounts';
import { getAddress } from 'viem';
import type { APIRequestContext } from '@playwright/test';

// USDC contract on Unichain Sepolia
export const USDC_ADDRESS = '0x31d0220469e10c4E71834a79b1f276d740d3768F';

// Deployer / payTo address
export const PAY_TO = '0x3D0e10329c864A7422761af058f909267a776029';

// Network identifier (CAIP-2)
export const NETWORK = 'eip155:1301';

// EIP-712 domain for USDC on Unichain Sepolia (from payment requirements extra)
const USDC_DOMAIN = {
  name: 'USDC',
  version: '2',
  chainId: 1301,
  verifyingContract: getAddress(USDC_ADDRESS) as `0x${string}`,
} as const;

// EIP-3009 TransferWithAuthorization types
const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

/**
 * Parse a base64-encoded payment-required header into a PaymentRequired object.
 */
function decodePaymentRequired(headerValue: string) {
  const json = Buffer.from(headerValue, 'base64').toString('utf-8');
  return JSON.parse(json);
}

/**
 * Build and sign an x402 payment payload for a given set of payment requirements.
 */
async function createPaymentPayload(
  privateKey: `0x${string}`,
  paymentRequired: {
    x402Version: number;
    resource: { url: string; description: string; mimeType: string };
    accepts: Array<{
      scheme: string;
      network: string;
      amount: string;
      asset: string;
      payTo: string;
      maxTimeoutSeconds: number;
      extra: Record<string, unknown>;
    }>;
  },
) {
  const account = privateKeyToAccount(privateKey);
  const requirements = paymentRequired.accepts[0];
  const now = Math.floor(Date.now() / 1000);
  const nonce = randomNonce();

  const authorization = {
    from: getAddress(account.address),
    to: getAddress(requirements.payTo),
    value: requirements.amount,
    validAfter: (now - 600).toString(),
    validBefore: (now + requirements.maxTimeoutSeconds).toString(),
    nonce,
  };

  const signature = await account.signTypedData({
    domain: USDC_DOMAIN,
    types: TRANSFER_WITH_AUTH_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: getAddress(authorization.from) as `0x${string}`,
      to: getAddress(authorization.to) as `0x${string}`,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: paymentRequired.x402Version,
    resource: paymentRequired.resource,
    accepted: requirements,
    payload: {
      authorization,
      signature,
    },
  };
}

/**
 * Encode a payment payload as the PAYMENT-SIGNATURE header value (base64 JSON).
 */
function encodePaymentHeader(payload: unknown): Record<string, string> {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return { 'PAYMENT-SIGNATURE': encoded };
}

/**
 * Execute a full x402 payment flow against a Playwright request context.
 *
 * 1. POST the endpoint (expect 402)
 * 2. Parse payment requirements from the payment-required header
 * 3. Sign an EIP-3009 TransferWithAuthorization
 * 4. Retry with the PAYMENT-SIGNATURE header
 * 5. Return the final response
 */
export async function payAndRetry(
  request: APIRequestContext,
  url: string,
  opts: {
    method?: 'GET' | 'POST';
    data?: unknown;
    headers?: Record<string, string>;
    privateKey?: string;
  } = {},
) {
  const key = (opts.privateKey || process.env.E2E_PAYER_PRIVATE_KEY) as `0x${string}`;
  if (!key) {
    throw new Error(
      'E2E_PAYER_PRIVATE_KEY env var is required for paid flow tests.',
    );
  }

  const method = opts.method ?? 'POST';

  // Step 1: initial request -> expect 402
  const firstRes = method === 'POST'
    ? await request.post(url, { data: opts.data, headers: opts.headers })
    : await request.get(url, { headers: opts.headers });

  if (firstRes.status() !== 402) {
    return firstRes;
  }

  // Step 2: parse payment requirements
  const prHeader = firstRes.headers()['payment-required'];
  if (!prHeader) {
    throw new Error('402 response missing payment-required header');
  }
  const paymentRequired = decodePaymentRequired(prHeader);

  // Step 3: sign payment
  const paymentPayload = await createPaymentPayload(key, paymentRequired);

  // Step 4: encode and retry
  const paymentHeaders = encodePaymentHeader(paymentPayload);
  const mergedHeaders = { ...opts.headers, ...paymentHeaders };

  const paidRes = method === 'POST'
    ? await request.post(url, { data: opts.data, headers: mergedHeaders })
    : await request.get(url, { headers: mergedHeaders });

  return paidRes;
}
