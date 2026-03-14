import { test, expect } from '@playwright/test';

test.describe('Security headers on API routes', () => {
  test('middleware sets required security headers', async ({ request }) => {
    const res = await request.get('/api/health');

    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');

    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
  });
});
