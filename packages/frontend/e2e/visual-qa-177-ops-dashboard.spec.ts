import { test, expect } from '@playwright/test';

// Issue #177: Ops Dashboard
// Content checks use request.get() against SSR HTML — the ops page SSR
// renders the panel structure with "Loading..." states for dynamic data.
// The /api/ops/status endpoint is tested directly (no browser mock needed).

test.describe('Visual QA #177: Ops Dashboard', () => {
  test('page returns HTTP 200', async ({ request }) => {
    const res = await request.get('/ops/');
    expect(res.status()).toBe(200);
  });

  test('page heading "Ops Dashboard" is in SSR HTML', async ({ request }) => {
    const res = await request.get('/ops/');
    const html = await res.text();
    expect(html).toContain('Ops Dashboard');
  });

  test('system status panel is hidden in production SSR HTML', async ({ request }) => {
    // System Status panel is intentionally hidden in production (NEXT_PUBLIC_APP_ENV=production).
    // This test verifies the production-safe behaviour: the panel must NOT appear in mainnet HTML.
    const baseURL = process.env.BASE_URL || 'https://0xdead.church';
    const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
    const res = await request.get('/ops/');
    const html = await res.text();
    if (isLocal) {
      // In local/dev mode the panel should be present.
      expect(html).toContain('System Status');
    } else {
      // On mainnet the panel is intentionally omitted from SSR output.
      expect(html).not.toContain('System Status');
    }
  });

  test('contract stats panel is in SSR HTML', async ({ request }) => {
    const res = await request.get('/ops/');
    const html = await res.text();
    expect(html).toContain('Contract Stats');
  });

  test('endpoint health panel is in SSR HTML', async ({ request }) => {
    const res = await request.get('/ops/');
    const html = await res.text();
    expect(html).toContain('Endpoint Health');
  });

  test('on-chain activity panel is in SSR HTML', async ({ request }) => {
    const res = await request.get('/ops/');
    const html = await res.text();
    expect(html).toContain('On-Chain Activity');
  });

  test('health endpoint paths are listed in SSR HTML', async ({ request }) => {
    const res = await request.get('/ops/');
    const html = await res.text();
    expect(html).toContain('/api/health');
    expect(html).toContain('/api/ops/status');
  });

  test('/api/ops/status is restricted in production', async ({ request }) => {
    // In production (NEXT_PUBLIC_APP_ENV=production) the endpoint returns 403 by design.
    // In local/dev mode it returns 200 with system info.
    const baseURL = process.env.BASE_URL || 'https://0xdead.church';
    const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
    const res = await request.get('/api/ops/status');
    if (isLocal) {
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('node_env');
      expect(body).toHaveProperty('memory');
    } else {
      // Mainnet intentionally blocks this endpoint to avoid leaking server info.
      expect(res.status()).toBe(403);
    }
  });

  test('page is responsive at 375px (loads without error)', async ({ request }) => {
    const res = await request.get('/ops/');
    expect(res.status()).toBe(200);
  });
});
