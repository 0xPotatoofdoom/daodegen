import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the route
vi.mock('@/lib/auth', () => ({
  verifyAgentIdentity: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  reqLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('@/lib/errors', () => ({
  apiError: (status: number, code: string, details?: Record<string, unknown>) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ code, message: code, ...(details || {}) }, { status });
  },
  Errors: {
    AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  getTraceId: () => 'test-trace-id',
}));

vi.mock('@/lib/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
  },
}));

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    // In tests, getAddress just returns the input (real checksumming is tested elsewhere)
    getAddress: (addr: string) => addr,
  };
});

// Use vi.hoisted() to define mocks that can be referenced inside vi.mock factories
const {
  mockSign,
  mockSetExpirationTime,
  mockSetIssuedAt,
  mockSetProtectedHeader,
  mockConstructorSpy,
} = vi.hoisted(() => ({
  mockSign: vi.fn(),
  mockSetExpirationTime: vi.fn(),
  mockSetIssuedAt: vi.fn(),
  mockSetProtectedHeader: vi.fn(),
  mockConstructorSpy: vi.fn(),
}));

vi.mock('jose', () => {
  class MockSignJWT {
    payload: Record<string, unknown>;

    constructor(payload: Record<string, unknown>) {
      mockConstructorSpy(payload);
      this.payload = payload;
    }

    setProtectedHeader(...args: unknown[]) {
      mockSetProtectedHeader(...args);
      return this;
    }

    setIssuedAt() {
      mockSetIssuedAt();
      return this;
    }

    setExpirationTime(...args: unknown[]) {
      mockSetExpirationTime(...args);
      return this;
    }

    sign(...args: unknown[]) {
      return mockSign(...args);
    }
  }

  return { SignJWT: MockSignJWT };
});

import { POST } from './route';
import { verifyAgentIdentity } from '@/lib/auth';

const mockedVerify = vi.mocked(verifyAgentIdentity);

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSign.mockResolvedValue('mock-jwt-token');
  });

  it('returns 200 with token and sets cookie on valid verification', async () => {
    mockedVerify.mockResolvedValue({
      success: true,
      address: '0x1234567890abcdef1234567890abcdef12345678',
      agentId: 'agent-42',
    });

    const request = makeRequest({
      message: 'valid-siwe-message',
      signature: '0xvalidsig',
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.token).toBe('mock-jwt-token');

    // Verify cookie is set
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie!).toContain('auth-token=');
    expect(setCookie!).toContain('HttpOnly');
    // Next.js serializes sameSite in lowercase
    expect(setCookie!.toLowerCase()).toContain('samesite=strict');
  });

  it('calls verifyAgentIdentity with message and signature', async () => {
    mockedVerify.mockResolvedValue({
      success: true,
      address: '0xabc',
      agentId: '1',
    });

    const request = makeRequest({
      message: 'my-siwe-message',
      signature: '0xmysig',
    });

    await POST(request as any);

    expect(mockedVerify).toHaveBeenCalledWith({
      message: 'my-siwe-message',
      signature: '0xmysig',
    });
  });

  it('returns 401 when verifyAgentIdentity fails', async () => {
    mockedVerify.mockResolvedValue({
      success: false,
      error: 'Invalid signature',
    });

    const request = makeRequest({
      message: 'bad-message',
      signature: '0xbadsig',
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('returns 401 when address is not a registered agent', async () => {
    mockedVerify.mockResolvedValue({
      success: false,
      error: 'Address is not a registered Agent (EIP-8004)',
    });

    const request = makeRequest({
      message: 'valid-message',
      signature: '0xvalidsig',
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('returns 500 when request body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });

  it('creates JWT with correct claims', async () => {
    mockedVerify.mockResolvedValue({
      success: true,
      address: '0xDeadBeef',
      agentId: 'agent-7',
    });

    const request = makeRequest({
      message: 'valid-message',
      signature: '0xvalidsig',
    });

    await POST(request as any);

    expect(mockConstructorSpy).toHaveBeenCalledWith({
      sub: '0xDeadBeef',
      walletAddress: '0xDeadBeef',
      agentId: 'agent-7',
    });
    expect(mockSetProtectedHeader).toHaveBeenCalledWith({ alg: 'HS256' });
    expect(mockSetIssuedAt).toHaveBeenCalled();
    expect(mockSetExpirationTime).toHaveBeenCalledWith('24h');
  });

  it('returns 500 when JWT signing fails', async () => {
    mockedVerify.mockResolvedValue({
      success: true,
      address: '0xabc',
      agentId: '1',
    });

    mockSign.mockRejectedValueOnce(new Error('signing error'));

    const request = makeRequest({
      message: 'valid-message',
      signature: '0xvalidsig',
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });

  it('cookie has maxAge of 1 day (86400 seconds)', async () => {
    mockedVerify.mockResolvedValue({
      success: true,
      address: '0xabc',
      agentId: '1',
    });

    const request = makeRequest({
      message: 'valid-message',
      signature: '0xvalidsig',
    });

    const response = await POST(request as any);
    const setCookie = response.headers.get('set-cookie');

    expect(setCookie).toBeTruthy();
    expect(setCookie!).toContain('Max-Age=86400');
  });
});
