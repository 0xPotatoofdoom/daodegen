import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { APIRequestContext } from '@playwright/test';

// Hardhat account #0 private key (well-known, never use for real funds)
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export const wallet = new ethers.Wallet(PRIVATE_KEY);

// Resolve the base URL for SIWE messages from Playwright config or env.
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3031';

/**
 * Perform a full SIWE authentication flow and return the JWT token.
 *
 * 1. GET /api/auth/nonce  -> { nonce }
 * 2. Build + sign a SiweMessage
 * 3. POST /api/auth/verify -> { token }
 */
export async function authenticate(request: APIRequestContext): Promise<string> {
  // 1. Get nonce
  const nonceRes = await request.get('/api/auth/nonce');
  const { nonce } = await nonceRes.json();

  // 2. Build SIWE message
  const siweMessage = new SiweMessage({
    domain: 'localhost',
    address: wallet.address,
    statement: 'Sign in to DaoDeGen',
    uri: BASE_URL,
    version: '1',
    chainId: 1301,
    nonce,
  });

  const messageStr = siweMessage.prepareMessage();
  const signature = await wallet.signMessage(messageStr);

  // 3. Verify and get JWT
  const verifyRes = await request.post('/api/auth/verify', {
    data: { message: messageStr, signature },
  });

  const body = await verifyRes.json();
  if (!body.token) {
    console.error('[auth fixture] verify failed:', verifyRes.status(), JSON.stringify(body));
  }
  return body.token;
}
