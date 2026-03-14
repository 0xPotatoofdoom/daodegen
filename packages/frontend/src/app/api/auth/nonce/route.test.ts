import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getNonce: vi.fn(),
}));

import { GET } from './route';
import { getNonce } from '@/lib/auth';

const mockedGetNonce = vi.mocked(getNonce);

describe('GET /api/auth/nonce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with a nonce string', async () => {
    mockedGetNonce.mockReturnValue('abc123nonce');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ nonce: 'abc123nonce' });
  });

  it('returns correct content-type header', async () => {
    mockedGetNonce.mockReturnValue('xyz789');

    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('calls getNonce exactly once per request', async () => {
    mockedGetNonce.mockReturnValue('single-call');

    await GET();

    expect(mockedGetNonce).toHaveBeenCalledTimes(1);
  });

  it('returns different nonces for different calls', async () => {
    mockedGetNonce.mockReturnValueOnce('nonce-1').mockReturnValueOnce('nonce-2');

    const response1 = await GET();
    const response2 = await GET();
    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.nonce).toBe('nonce-1');
    expect(data2.nonce).toBe('nonce-2');
  });

  it('response body contains only the nonce field', async () => {
    mockedGetNonce.mockReturnValue('only-nonce');

    const response = await GET();
    const data = await response.json();

    expect(Object.keys(data)).toEqual(['nonce']);
  });
});
