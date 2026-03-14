import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { wallet, authenticate } from './fixtures/auth';

test.describe('Auth -- nonce + SIWE verify', () => {
  test('GET /api/auth/nonce returns a unique nonce each call', async ({ request }) => {
    const res1 = await request.get('/api/auth/nonce');
    const res2 = await request.get('/api/auth/nonce');

    expect(res1.status()).toBe(200);
    expect(res2.status()).toBe(200);

    const { nonce: n1 } = await res1.json();
    const { nonce: n2 } = await res2.json();

    expect(typeof n1).toBe('string');
    expect(n1.length).toBeGreaterThan(0);
    expect(n1).not.toBe(n2);
  });

  test('valid SIWE flow returns a JWT token', async ({ request }) => {
    const token = await authenticate(request);

    expect(typeof token).toBe('string');
    // JWT has 3 dot-separated parts
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  test('replayed nonce returns 401', async ({ request }) => {
    // Get a nonce and use it once
    const nonceRes = await request.get('/api/auth/nonce');
    const { nonce } = await nonceRes.json();

    const msg = new SiweMessage({
      domain: 'localhost',
      address: wallet.address,
      statement: 'Sign in to DaoDeGen',
      uri: process.env.E2E_BASE_URL || 'http://localhost:3031',
      version: '1',
      chainId: 1301,
      nonce,
    });

    const messageStr = msg.prepareMessage();
    const signature = await wallet.signMessage(messageStr);

    // First use -- should succeed
    const first = await request.post('/api/auth/verify', {
      data: { message: messageStr, signature },
    });
    expect(first.status()).toBe(200);

    // Second use (replay) -- should fail
    const replay = await request.post('/api/auth/verify', {
      data: { message: messageStr, signature },
    });
    expect(replay.status()).toBe(401);
  });

  test('invalid signature returns 401', async ({ request }) => {
    const nonceRes = await request.get('/api/auth/nonce');
    const { nonce } = await nonceRes.json();

    const msg = new SiweMessage({
      domain: 'localhost',
      address: wallet.address,
      statement: 'Sign in to DaoDeGen',
      uri: process.env.E2E_BASE_URL || 'http://localhost:3031',
      version: '1',
      chainId: 1301,
      nonce,
    });

    const messageStr = msg.prepareMessage();

    // Sign with a different wallet
    const rogue = ethers.Wallet.createRandom();
    const badSig = await rogue.signMessage(messageStr);

    const res = await request.post('/api/auth/verify', {
      data: { message: messageStr, signature: badSig },
    });
    expect(res.status()).toBe(401);
  });

  test('missing body returns error', async ({ request }) => {
    const res = await request.post('/api/auth/verify', {
      data: {},
    });
    // Server should return 401 or 500 (not 200)
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
