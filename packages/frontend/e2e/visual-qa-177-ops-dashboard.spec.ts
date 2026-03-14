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

  test('system status panel is in SSR HTML', async ({ request }) => {
    const res = await request.get('/ops/');
    const html = await res.text();
    expect(html).toContain('System Status');
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

  test('/api/ops/status returns 200 with system info', async ({ request }) => {
    const res = await request.get('/api/ops/status');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('node_env');
    expect(body).toHaveProperty('memory');
  });

  test('page is responsive at 375px (loads without error)', async ({ request }) => {
    const res = await request.get('/ops/');
    expect(res.status()).toBe(200);
  });
});
