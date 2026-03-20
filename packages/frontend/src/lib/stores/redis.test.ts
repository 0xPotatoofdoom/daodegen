import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrayerRecord } from './types';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue("OK");
const mockDel = vi.fn().mockResolvedValue(1);
const mockLrange = vi.fn().mockResolvedValue([]);
const mockRpush = vi.fn().mockResolvedValue(1);
const mockLtrim = vi.fn().mockResolvedValue("OK");
const mockLpop = vi.fn().mockResolvedValue(null);
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
    lrange: mockLrange,
    rpush: mockRpush,
    ltrim: mockLtrim,
    lpop: mockLpop,
    connect: mockConnect,
    on: mockOn,
    exists: vi.fn(),
  })),
}));

import {
  RedisNonceStore,
  RedisRateLimitStore,
  RedisCongregationStore,
} from './redis';

function createMockRedis() {
  return {
    get: mockGet,
    set: mockSet,
    del: mockDel,
    lrange: mockLrange,
    rpush: mockRpush,
    ltrim: mockLtrim,
    lpop: mockLpop,
    connect: mockConnect,
    on: mockOn,
    exists: vi.fn(),
  } as any;
}

describe('RedisNonceStore', () => {
  let store: RedisNonceStore;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = createMockRedis();
    store = new RedisNonceStore(redis);
  });

  it('get returns undefined for unknown nonce', () => {
    expect(store.get('unknown')).toBeUndefined();
  });

  it('set stores in cache and calls redis.set', () => {
    const expiry = Date.now() + 60_000;
    store.set('abc', expiry);
    expect(store.get('abc')).toBe(expiry);
    expect(mockSet).toHaveBeenCalledWith(
      'nonce:abc',
      String(expiry),
      'EX',
      expect.any(Number),
    );
  });

  it('get returns cached value after set', () => {
    const expiry = Date.now() + 30_000;
    store.set('nonce1', expiry);
    expect(store.get('nonce1')).toBe(expiry);
  });

  it('delete removes from cache and calls redis.del', () => {
    store.set('nonce2', Date.now() + 10_000);
    store.delete('nonce2');
    expect(store.get('nonce2')).toBeUndefined();
    expect(mockDel).toHaveBeenCalledWith('nonce:nonce2');
  });

  it('size returns cache size', () => {
    store.set('a', Date.now() + 10_000);
    store.set('b', Date.now() + 10_000);
    expect(store.size()).toBe(2);
  });

  it('entries returns iterable of cache entries', () => {
    const expiryA = Date.now() + 10_000;
    const expiryB = Date.now() + 20_000;
    store.set('a', expiryA);
    store.set('b', expiryB);
    const entries = Array.from(store.entries());
    expect(entries).toEqual([
      ['a', expiryA],
      ['b', expiryB],
    ]);
  });

  it('getAsync returns cached value if available', async () => {
    const expiry = Date.now() + 10_000;
    store.set('cached', expiry);
    const result = await store.getAsync('cached');
    expect(result).toBe(expiry);
    // Should not call redis.get since it was in cache
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('getAsync falls back to redis when not in cache', async () => {
    const expiry = Date.now() + 10_000;
    mockGet.mockResolvedValueOnce(String(expiry));
    const result = await store.getAsync('remote');
    expect(result).toBe(expiry);
    expect(mockGet).toHaveBeenCalledWith('nonce:remote');
  });
});

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = createMockRedis();
    store = new RedisRateLimitStore(redis);
  });

  it('get/set stores and retrieves rate buckets', () => {
    const bucket = { timestamps: [1, 2, 3] };
    store.set('user:1', bucket);
    expect(store.get('user:1')).toEqual(bucket);
    expect(mockSet).toHaveBeenCalledWith(
      'rate:user:1',
      JSON.stringify(bucket),
      'EX',
      300,
    );
  });

  it('delete removes bucket', () => {
    store.set('user:2', { timestamps: [1] });
    store.delete('user:2');
    expect(store.get('user:2')).toBeUndefined();
    expect(mockDel).toHaveBeenCalledWith('rate:user:2');
  });

  it('entries returns iterable', () => {
    const bucket1 = { timestamps: [10] };
    const bucket2 = { timestamps: [20] };
    store.set('a', bucket1);
    store.set('b', bucket2);
    const entries = Array.from(store.entries());
    expect(entries).toEqual([
      ['a', bucket1],
      ['b', bucket2],
    ]);
  });
});

describe('RedisCongregationStore', () => {
  let store: RedisCongregationStore;
  let redis: ReturnType<typeof createMockRedis>;

  const record: PrayerRecord = {
    sender: '0xABC',
    sentimentTag: 'hope',
    timestamp: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redis = createMockRedis();
    store = new RedisCongregationStore(redis);
  });

  it('push adds record and calls redis.rpush', () => {
    store.push(record);
    expect(store.length()).toBe(1);
    expect(mockRpush).toHaveBeenCalledWith(
      'congregation:prayers',
      JSON.stringify(record),
    );
  });

  it('shift removes first record and calls redis.lpop', () => {
    store.push(record);
    const shifted = store.shift();
    expect(shifted).toEqual(record);
    expect(store.length()).toBe(0);
    expect(mockLpop).toHaveBeenCalledWith('congregation:prayers');
  });

  it('first returns first record without removing', () => {
    store.push(record);
    expect(store.first()).toEqual(record);
    expect(store.length()).toBe(1);
  });

  it('length returns count', () => {
    expect(store.length()).toBe(0);
    store.push(record);
    store.push({ ...record, sender: '0xDEF' });
    expect(store.length()).toBe(2);
  });

  it('all returns all records', () => {
    const record2: PrayerRecord = { sender: '0xDEF', sentimentTag: 'peace', timestamp: 2000 };
    store.push(record);
    store.push(record2);
    const all = Array.from(store.all());
    expect(all).toEqual([record, record2]);
  });

  it('clear empties records and calls redis.del', () => {
    store.push(record);
    store.clear();
    expect(store.length()).toBe(0);
    expect(mockDel).toHaveBeenCalledWith('congregation:prayers');
  });
});
