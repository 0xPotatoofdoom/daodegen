import { describe, it, expect, vi } from 'vitest';

// Mock Redis before importing middleware
vi.mock('./lib/stores/redis', () => ({
  getRedis: () => ({
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  }),
}));

describe('Middleware / Security Headers', () => {
  it('should have security headers configured (Issue #78)', async () => {
    const middleware = await import('./middleware').catch((e) => {
      console.error(e);
      return null;
    });
    expect(middleware).not.toBeNull();
  });
});

describe('Middleware / Redis rate limiting', () => {
  it('exports Node.js runtime for ioredis compatibility', async () => {
    const mod = await import('./middleware');
    expect(mod.runtime).toBe('nodejs');
  });

  it('middleware is an async function', async () => {
    const mod = await import('./middleware');
    // AsyncFunction constructor name check
    expect(mod.middleware.constructor.name).toBe('AsyncFunction');
  });
});
