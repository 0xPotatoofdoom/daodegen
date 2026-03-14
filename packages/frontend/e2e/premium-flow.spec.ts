import { test, expect } from '@playwright/test';

test.describe('Verse Oracle -- x402 payment gating', () => {
  test('lookup without payment returns 402', async ({ request }) => {
    const res = await request.post('/v1/verse/lookup', {
      data: { verse: 42 },
    });
    expect(res.status()).toBe(402);
  });

  test('commentary without payment returns 402', async ({ request }) => {
    const res = await request.post('/v1/verse/commentary', {
      data: { verse: 42, context: 'considering a leveraged position' },
    });
    expect(res.status()).toBe(402);
  });

  test('oracle without payment returns 402', async ({ request }) => {
    const res = await request.post('/v1/verse/oracle', {
      data: { state: 'market is ranging, holding stables' },
    });
    expect(res.status()).toBe(402);
  });

  test('valid JWT without payment still returns 402', async ({ request }) => {
    const { authenticate } = await import('./fixtures/auth');
    const jwt = await authenticate(request);

    const res = await request.post('/v1/verse/lookup', {
      headers: { Authorization: `Bearer ${jwt}` },
      data: { verse: 1 },
    });
    expect(res.status()).toBe(402);
  });
});
