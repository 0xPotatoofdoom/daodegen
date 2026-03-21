export type { NonceStore, RateLimitStore, CongregationStore, RateBucket, PrayerRecord, BroadcastStore, BroadcastEntry } from './types';
import { MemoryNonceStore, MemoryRateLimitStore, MemoryCongregationStore, MemoryBroadcastStore } from './memory';

/**
 * Store factory — returns Redis-backed stores when REDIS_URL is set,
 * otherwise falls back to in-memory (fine for dev, not for production).
 */
function useRedis(): boolean {
  return !!process.env.REDIS_URL;
}

export function createNonceStore() {
  if (useRedis()) {
    const { RedisNonceStore } = require('./redis');
    return new RedisNonceStore();
  }
  return new MemoryNonceStore();
}

export function createRateLimitStore() {
  if (useRedis()) {
    const { RedisRateLimitStore } = require('./redis');
    return new RedisRateLimitStore();
  }
  return new MemoryRateLimitStore();
}

export function createCongregationStore() {
  if (useRedis()) {
    const { RedisCongregationStore } = require('./redis');
    return new RedisCongregationStore();
  }
  return new MemoryCongregationStore();
}

export function createBroadcastStore() {
  if (useRedis()) {
    const { RedisBroadcastStore } = require('./redis');
    return new RedisBroadcastStore();
  }
  return new MemoryBroadcastStore();
}
