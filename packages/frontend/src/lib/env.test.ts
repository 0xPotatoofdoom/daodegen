import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Environment Validation', () => {
  it('should validate environment variables using Zod (Issue #96)', async () => {
    // Expect a schema export to exist
    // @ts-ignore - non-existent file
    const envModule = await import('./env').catch(() => null);
    expect(envModule).not.toBeNull();
    expect(envModule!.env).toBeDefined();
  });
});

describe('env module — dev defaults path', () => {
  afterEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('uses dev defaults and warns when JWT_SECRET is missing in non-production', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.JWT_SECRET;
    vi.resetModules();
    const { env } = await import('./env');
    expect(env.JWT_SECRET).toBe('dev-secret-do-not-use-in-production');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[env]'));
    consoleSpy.mockRestore();
  });

  it('returns parsed env when all required vars are present', async () => {
    process.env.JWT_SECRET = 'another-secret';
    vi.resetModules();
    const { env } = await import('./env');
    expect(env.JWT_SECRET).toBe('another-secret');
  });
});
