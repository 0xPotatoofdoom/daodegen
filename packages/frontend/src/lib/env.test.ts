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
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
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
    process.env.JWT_SECRET = 'another-secret-that-is-long-enough-for-validation';
    vi.resetModules();
    const { env } = await import('./env');
    expect(env.JWT_SECRET).toBe('another-secret-that-is-long-enough-for-validation');
  });
});

describe('env module — production JWT_SECRET validation (#313)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  });

  it('rejects known weak JWT_SECRET values in production', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'build-placeholder';
    vi.resetModules();
    await import('./env');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('known placeholder'));
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects JWT_SECRET shorter than 32 chars in production', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'too-short';
    vi.resetModules();
    await import('./env');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('at least 32 characters'));
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
