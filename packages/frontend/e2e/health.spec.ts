import { test, expect } from '@playwright/test';

test.describe('GET /api/health', () => {
  test('returns 200 with status ok and timestamp', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body).toHaveProperty('timestamp');
    expect(body).not.toHaveProperty('version');
  });

  test('timestamp is valid ISO 8601', async ({ request }) => {
    const res = await request.get('/api/health');
    const { timestamp } = await res.json();

    const parsed = new Date(timestamp);
    expect(parsed.toISOString()).toBe(timestamp);
  });
});
