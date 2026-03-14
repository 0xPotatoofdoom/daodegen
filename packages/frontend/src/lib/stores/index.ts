export type { NonceStore, RateLimitStore, CongregationStore, RateBucket, PrayerRecord } from './types';
import { MemoryNonceStore, MemoryRateLimitStore, MemoryCongregationStore } from './memory';

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
