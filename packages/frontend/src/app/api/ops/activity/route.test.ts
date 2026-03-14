import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ponder', () => ({
  fetchActivity: vi.fn(),
}));

import { GET } from './route';
import { fetchActivity } from '@/lib/ponder';

const mockedFetchActivity = vi.mocked(fetchActivity);

describe('GET /api/ops/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns activity events array on success', async () => {
    const mockEvents = [
      {
        type: 'mint',
        timestamp: '2025-01-01T00:00:00Z',
        txHash: '0xabc123',
        blockNumber: '1000',
        details: { minter: '0x1234', tokenId: '1' },
      },
      {
        type: 'prayer',
        timestamp: '2025-01-01T01:00:00Z',
        txHash: '0xdef456',
        blockNumber: '1001',
        details: { sender: '0x5678', amount: '100' },
      },
    ];

    mockedFetchActivity.mockResolvedValue(mockEvents as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.events).toEqual(mockEvents);
    expect(Array.isArray(data.events)).toBe(true);
  });

  it('returns 503 when Ponder is unavailable (fetchActivity returns null)', async () => {
    mockedFetchActivity.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Ponder unavailable');
    expect(data.events).toEqual([]);
  });

  it('calls fetchActivity with limit of 50', async () => {
    mockedFetchActivity.mockResolvedValue([]);

    await GET();

    expect(mockedFetchActivity).toHaveBeenCalledWith(50);
  });

  it('returns empty events array when fetchActivity returns empty array', async () => {
    mockedFetchActivity.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.events).toEqual([]);
  });

  it('returns application/json content-type', async () => {
    mockedFetchActivity.mockResolvedValue([]);

    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('503 response includes both error message and empty events array', async () => {
    mockedFetchActivity.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(Object.keys(data)).toContain('error');
    expect(Object.keys(data)).toContain('events');
    expect(data.events).toEqual([]);
  });

  it('preserves all fields in activity events', async () => {
    const detailedEvent = {
      type: 'fee_release',
      timestamp: '2025-06-15T12:00:00Z',
      txHash: '0xfee123',
      blockNumber: '5000',
      details: {
        caller: '0xabc',
        burnAmount: '1000000000000000000',
        nftHolders: '500000000000000000',
      },
    };

    mockedFetchActivity.mockResolvedValue([detailedEvent] as any);

    const response = await GET();
    const data = await response.json();

    expect(data.events[0]).toEqual(detailedEvent);
    expect(data.events[0].details.burnAmount).toBe('1000000000000000000');
  });
});
