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
  it('returns ok when all checks pass (anthropic)', async () => {
    process.env.NEXT_PUBLIC_UNICHAIN_RPC = 'https://rpc.test.com';
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.checks.rpc.status).toBe('ok');
    expect(body.checks.rpc.latency_ms).toBeTypeOf('number');
    expect(body.checks.llm.status).toBe('ok');
    expect(body.checks.llm.provider).toBe('anthropic');
    expect(body.timestamp).toBeTruthy();
  });

  it('returns ok with venice as active provider when venice key is set', async () => {
    process.env.NEXT_PUBLIC_UNICHAIN_RPC = 'https://rpc.test.com';
    process.env.VENICE_API_KEY = 'venice-test-key';

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.checks.llm.status).toBe('ok');
    expect(body.checks.llm.provider).toBe('venice');
  });

  it('returns ok with bankr as active provider when bankr key is set', async () => {
    process.env.NEXT_PUBLIC_UNICHAIN_RPC = 'https://rpc.test.com';
    process.env.BANKR_API_KEY = 'bankr-test-key';

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.checks.llm.status).toBe('ok');
    expect(body.checks.llm.provider).toBe('bankr');
  });

  it('prefers venice over anthropic (matches provider priority)', async () => {
    process.env.NEXT_PUBLIC_UNICHAIN_RPC = 'https://rpc.test.com';
    process.env.VENICE_API_KEY = 'venice-test-key';
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.checks.llm.provider).toBe('venice');
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

  it('returns degraded when no LLM provider key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.VENICE_API_KEY;
    delete process.env.BANKR_API_KEY;

    mockFetch.mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.llm.status).toBe('fail');
    expect(body.checks.llm.error).toContain('No LLM provider key set');
  });

  it('returns degraded when all checks fail', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.VENICE_API_KEY;
    delete process.env.BANKR_API_KEY;

    mockFetch.mockRejectedValue(new Error('timeout'));

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.rpc.status).toBe('fail');
    expect(body.checks.llm.status).toBe('fail');
  });
});
