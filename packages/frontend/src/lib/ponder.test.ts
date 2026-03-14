import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the env module before importing ponder functions
vi.mock('./env', () => ({
  env: {
    PONDER_API_URL: 'http://localhost:42069',
  },
}));

import {
  fetchPrayerStats,
  fetchRecentFees,
  fetchNftHolders,
  fetchRecentMints,
  fetchActivity,
} from './ponder';

// Access the mocked env so we can change it per-test
import { env } from './env';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

describe('ponder REST client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    // Reset env mock to default
    (env as { PONDER_API_URL: string }).PONDER_API_URL = 'http://localhost:42069';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchPrayerStats', () => {
    it('fetches from /prayers/stats endpoint', async () => {
      const statsData = { count: 42, totalBurned: '1000000000000000000' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(statsData),
      });

      const result = await fetchPrayerStats();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/prayers/stats',
        expect.objectContaining({ next: { revalidate: 30 } })
      );
      expect(result).toEqual(statsData);
    });

    it('returns null when PONDER_API_URL is not set', async () => {
      (env as { PONDER_API_URL: string }).PONDER_API_URL = '';

      const result = await fetchPrayerStats();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null when fetch throws an error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchPrayerStats();

      expect(result).toBeNull();
    });

    it('returns null when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchPrayerStats();

      expect(result).toBeNull();
    });
  });

  describe('fetchRecentFees', () => {
    it('fetches from /fees/recent with default limit of 10', async () => {
      const feesData = [
        {
          id: '1',
          caller: '0xabc',
          burnAmount: '500',
          nftHolders: '5',
          txHash: '0xhash1',
          timestamp: '2025-01-01',
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(feesData),
      });

      const result = await fetchRecentFees();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/fees/recent?limit=10',
        expect.any(Object)
      );
      expect(result).toEqual(feesData);
    });

    it('accepts a custom limit parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetchRecentFees(5);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/fees/recent?limit=5',
        expect.any(Object)
      );
    });

    it('returns null when PONDER_API_URL is empty', async () => {
      (env as { PONDER_API_URL: string }).PONDER_API_URL = '';

      const result = await fetchRecentFees();

      expect(result).toBeNull();
    });
  });

  describe('fetchNftHolders', () => {
    it('fetches from /nfts/holders endpoint', async () => {
      const holdersData = { '1': '0xabc', '2': '0xdef' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(holdersData),
      });

      const result = await fetchNftHolders();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/nfts/holders',
        expect.any(Object)
      );
      expect(result).toEqual(holdersData);
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await fetchNftHolders();

      expect(result).toBeNull();
    });
  });

  describe('fetchRecentMints', () => {
    it('fetches from /mints/recent with default limit of 20', async () => {
      const mintsData = [
        {
          id: '1',
          minter: '0xabc',
          tokenId: '1',
          txHash: '0xhash',
          timestamp: '2025-01-01',
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mintsData),
      });

      const result = await fetchRecentMints();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/mints/recent?limit=20',
        expect.any(Object)
      );
      expect(result).toEqual(mintsData);
    });

    it('accepts a custom limit parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetchRecentMints(3);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/mints/recent?limit=3',
        expect.any(Object)
      );
    });

    it('returns null when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchRecentMints();

      expect(result).toBeNull();
    });
  });

  describe('fetchActivity', () => {
    it('fetches from /activity with default limit of 50', async () => {
      const activityData = [
        {
          type: 'mint',
          timestamp: '2025-01-01',
          txHash: '0xhash',
          blockNumber: '100',
          details: { tokenId: '1' },
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(activityData),
      });

      const result = await fetchActivity();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/activity?limit=50',
        expect.any(Object)
      );
      expect(result).toEqual(activityData);
    });

    it('accepts a custom limit parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetchActivity(100);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069/activity?limit=100',
        expect.any(Object)
      );
    });

    it('returns null on network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await fetchActivity();

      expect(result).toBeNull();
    });

    it('returns null when PONDER_API_URL is not configured', async () => {
      (env as { PONDER_API_URL: string }).PONDER_API_URL = '';

      const result = await fetchActivity();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('revalidate option', () => {
    it('passes next.revalidate of 30 seconds to all requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchPrayerStats();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        { next: { revalidate: 30 } }
      );
    });
  });

  describe('URL construction', () => {
    it('constructs URL by concatenating base URL and path', async () => {
      (env as { PONDER_API_URL: string }).PONDER_API_URL = 'http://custom-host:9999';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchPrayerStats();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-host:9999/prayers/stats',
        expect.any(Object)
      );
    });

    it('handles base URL with trailing slash correctly', async () => {
      // The implementation does string concatenation, so trailing slash + leading slash
      // would produce a double slash. This documents current behavior.
      (env as { PONDER_API_URL: string }).PONDER_API_URL = 'http://localhost:42069/';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchPrayerStats();

      // Documents current behavior: double slash
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:42069//prayers/stats',
        expect.any(Object)
      );
    });
  });
});
