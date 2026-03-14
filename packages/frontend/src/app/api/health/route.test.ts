import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  vi.stubGlobal('fetch', mockFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = savedEnv;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('GET /api/health', () => {
  it('returns ok when all checks pass', async () => {
    process.env.NEXT_PUBLIC_UNICHAIN_RPC = 'https://rpc.test.com';
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.checks.rpc.status).toBe('ok');
    expect(body.checks.rpc.latency_ms).toBeTypeOf('number');
    expect(body.checks.anthropic.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  it('returns degraded when RPC returns non-ok status', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';

    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.rpc.status).toBe('fail');
    expect(body.checks.rpc.error).toContain('503');
    expect(body.checks.rpc.latency_ms).toBeTypeOf('number');
  });

  it('returns degraded when RPC fetch throws', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';

    mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.rpc.status).toBe('fail');
    expect(body.checks.rpc.error).toContain('Network unreachable');
  });

  it('returns degraded when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.anthropic.status).toBe('fail');
    expect(body.checks.anthropic.error).toContain('not set');
  });

  it('returns degraded when all checks fail', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    mockFetch.mockRejectedValue(new Error('timeout'));

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.rpc.status).toBe('fail');
    expect(body.checks.anthropic.status).toBe('fail');
  });
});
