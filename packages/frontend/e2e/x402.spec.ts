import { test, expect } from '@playwright/test';
import { payAndRetry } from './fixtures/x402-client';
import { authenticate } from './fixtures/auth';

// ---------------------------------------------------------------------------
// Unpaid flow -- no payment header, always expect 402
// ---------------------------------------------------------------------------

test.describe('x402 -- unpaid requests return 402', () => {
  test('POST /v1/verse/lookup without payment returns 402', async ({ request }) => {
    const res = await request.post('/v1/verse/lookup', {
      data: { verse: 1 },
    });
    expect(res.status()).toBe(402);
  });

  test('POST /v1/verse/commentary without payment returns 402', async ({ request }) => {
    const res = await request.post('/v1/verse/commentary', {
      data: { verse: 1, context: 'providing liquidity' },
    });
    expect(res.status()).toBe(402);
  });

  test('POST /v1/verse/oracle without payment returns 402', async ({ request }) => {
    const res = await request.post('/v1/verse/oracle', {
      data: { state: 'I hold 50 ETH in a lending protocol' },
    });
    expect(res.status()).toBe(402);
  });

  test('payment check runs before JWT auth', async ({ request }) => {
    const res = await request.post('/v1/verse/lookup', {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
      data: { verse: 1 },
    });
    expect(res.status()).toBe(402);
  });

  test('402 response includes payment requirements header', async ({ request }) => {
    const res = await request.post('/v1/verse/lookup', {
      data: { verse: 1 },
    });
    expect(res.status()).toBe(402);

    // v2 protocol puts requirements in the payment-required header (base64 JSON)
    const headers = res.headers();
    const prHeader = headers['payment-required'];
    expect(prHeader).toBeTruthy();

    // Decode and validate structure
    const decoded = JSON.parse(Buffer.from(prHeader, 'base64').toString('utf-8'));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toBeDefined();
    expect(decoded.accepts.length).toBeGreaterThan(0);

    const req = decoded.accepts[0];
    expect(req.scheme).toBe('exact');
    expect(req.network).toBe('eip155:1301');
    expect(req.asset).toBe('0x31d0220469e10c4E71834a79b1f276d740d3768F');
    expect(req.payTo).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(req.extra.name).toBe('USDC');
    expect(req.extra.version).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// Facilitator health -- verify the self-hosted facilitator is reachable
// ---------------------------------------------------------------------------

test.describe('x402 -- facilitator', () => {
  const facilitatorUrl = process.env.FACILITATOR_URL || 'http://localhost:4402';

  test('GET /supported returns eip155:1301', async ({ request }) => {
    const res = await request.get(`${facilitatorUrl}/supported`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.kinds).toBeDefined();
    expect(body.kinds.length).toBeGreaterThan(0);

    const kind = body.kinds[0];
    expect(kind.scheme).toBe('exact');
    expect(kind.network).toBe('eip155:1301');
  });

  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get(`${facilitatorUrl}/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.network).toBe('eip155:1301');
    expect(body).not.toHaveProperty('wallet');
  });
});

// ---------------------------------------------------------------------------
// Paid flow -- requires E2E_PAYER_PRIVATE_KEY (funded wallet with USDC)
// ---------------------------------------------------------------------------

const hasPayer = !!process.env.E2E_PAYER_PRIVATE_KEY;

test.describe('x402 -- paid verse lookup (live testnet)', () => {
  test.skip(!hasPayer, 'E2E_PAYER_PRIVATE_KEY not set -- skipping paid flow tests');

  // Serialize: the facilitator uses a single wallet, so concurrent settlements
  // can hit nonce conflicts on-chain.
  test.describe.configure({ mode: 'serial' });

  test('verse lookup with payment returns 200 + verse data', async ({ request }) => {
    const jwt = await authenticate(request);

    const res = await payAndRetry(request, '/v1/verse/lookup', {
      method: 'POST',
      data: { verse: 1 },
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.verse).toBe(1);
    expect(body.title).toBeTruthy();
    expect(body.text).toBeTruthy();
    expect(body.interpretation).toBeTruthy();
  });

  test('verse commentary with payment returns 200', async ({ request }) => {
    const jwt = await authenticate(request);

    const res = await payAndRetry(request, '/v1/verse/commentary', {
      method: 'POST',
      data: { verse: 42, context: 'providing liquidity on Uniswap v4' },
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.verse).toBe(42);
    expect(body.commentary).toBeTruthy();
  });

  test('verse oracle with payment returns 200', async ({ request }) => {
    const jwt = await authenticate(request);

    const res = await payAndRetry(request, '/v1/verse/oracle', {
      method: 'POST',
      data: { state: 'considering a leveraged ETH position' },
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.recommended_verse).toBeGreaterThanOrEqual(1);
    expect(body.recommended_verse).toBeLessThanOrEqual(81);
    expect(body.oracle_reading).toBeTruthy();
  });
});
