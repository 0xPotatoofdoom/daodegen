/**
 * Redis-backed store implementations.
 *
 * Drop-in replacements for the Memory* stores. Each method is synchronous
 * in the interface but uses Redis under the hood — we bridge the gap by
 * keeping a local Map as a write-through cache and syncing to Redis
 * asynchronously. This avoids changing every call-site to async while
 * still giving us durability across restarts.
 *
 * Trade-off: on cold start the cache is empty and populates lazily.
 * For nonces this is fine (expired nonces just get rejected).
 * For rate limits, a restart gives a brief window of unthrottled traffic.
 * For congregation, we preload on init.
 */

import Redis from "ioredis";
import type {
  NonceStore,
  RateBucket,
  RateLimitStore,
  PrayerRecord,
  CongregationStore,
} from "./types";

// Singleton Redis client
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keyPrefix: "daodegen:",
    });
    // Prevent unhandled error events from crashing the process
    // (ioredis emits 'error' which kills Node if unlistened)
    _redis.on('error', (err) => {
      console.error("[redis] Connection error:", err.message);
    });
    _redis.connect().catch((err) => {
      console.error("[redis] Connection failed:", err.message);
    });
  }
  return _redis;
}

// ─── NonceStore ────────────────────────────────────────────────────

export class RedisNonceStore implements NonceStore {
  private cache = new Map<string, number>();
  private redis: Redis;
  private prefix = "nonce:";

  constructor(redis?: Redis) {
    this.redis = redis || getRedis();
  }

  get(nonce: string): number | undefined {
    // Sync read from cache; Redis is populated write-through
    return this.cache.get(nonce);
  }

  async getAsync(nonce: string): Promise<number | undefined> {
    // Check cache first; fall back to Redis for post-restart recovery
    const cached = this.cache.get(nonce);
    if (cached !== undefined) return cached;
    try {
      const val = await this.redis.get(this.prefix + nonce);
      if (val) {
        const expiry = Number(val);
        this.cache.set(nonce, expiry); // warm the cache
        return expiry;
      }
    } catch (err) {
      console.error("[redis] NonceStore.getAsync failed:", err instanceof Error ? err.message : err);
    }
    return undefined;
  }

  set(nonce: string, expiry: number): void {
    this.cache.set(nonce, expiry);
    const ttl = Math.max(1, Math.ceil((expiry - Date.now()) / 1000));
    this.redis.set(this.prefix + nonce, String(expiry), "EX", ttl).catch((err) => {
      console.error("[redis] NonceStore.set failed:", err instanceof Error ? err.message : err);
    });
  }

  delete(nonce: string): void {
    this.cache.delete(nonce);
    this.redis.del(this.prefix + nonce).catch((err) => {
      console.error("[redis] NonceStore.delete failed:", err instanceof Error ? err.message : err);
    });
  }

  size(): number {
    return this.cache.size;
  }

  entries(): Iterable<[string, number]> {
    return this.cache.entries();
  }
}

// ─── RateLimitStore ────────────────────────────────────────────────

export class RedisRateLimitStore implements RateLimitStore {
  private cache = new Map<string, RateBucket>();
  private redis: Redis;
  private prefix = "rate:";
  private ttlSeconds: number;

  constructor(redis?: Redis, ttlSeconds = 300) {
    this.redis = redis || getRedis();
    this.ttlSeconds = ttlSeconds;
  }

  get(key: string): RateBucket | undefined {
    return this.cache.get(key);
  }

  set(key: string, bucket: RateBucket): void {
    this.cache.set(key, bucket);
    this.redis
      .set(this.prefix + key, JSON.stringify(bucket), "EX", this.ttlSeconds)
      .catch((err) => {
        console.error("[redis] RateLimitStore.set failed:", err instanceof Error ? err.message : err);
      });
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.redis.del(this.prefix + key).catch((err) => {
      console.error("[redis] RateLimitStore.delete failed:", err instanceof Error ? err.message : err);
    });
  }

  entries(): Iterable<[string, RateBucket]> {
    return this.cache.entries();
  }
}

// ─── CongregationStore ─────────────────────────────────────────────

const CONGREGATION_KEY = "congregation:prayers";
const MAX_CONGREGATION_SIZE = 1000;

export class RedisCongregationStore implements CongregationStore {
  private records: PrayerRecord[] = [];
  private redis: Redis;
  private loaded = false;

  constructor(redis?: Redis) {
    this.redis = redis || getRedis();
    // Preload from Redis on init
    this._preload();
  }

  private async _preload() {
    try {
      const raw = await this.redis.lrange(CONGREGATION_KEY, 0, MAX_CONGREGATION_SIZE - 1);
      this.records = raw.map((r) => JSON.parse(r) as PrayerRecord);
      this.loaded = true;
    } catch {
      // Fallback: start empty, records will accumulate from new prayers
      this.loaded = true;
    }
  }

  push(record: PrayerRecord): void {
    this.records.push(record);
    // Trim in-memory
    if (this.records.length > MAX_CONGREGATION_SIZE) {
      this.records.shift();
    }
    // Push to Redis list + trim
    this.redis
      .rpush(CONGREGATION_KEY, JSON.stringify(record))
      .then(() => this.redis.ltrim(CONGREGATION_KEY, -MAX_CONGREGATION_SIZE, -1))
      .catch((err) => {
        console.error("[redis] CongregationStore.push failed:", err instanceof Error ? err.message : err);
      });
  }

  shift(): PrayerRecord | undefined {
    const record = this.records.shift();
    if (record) {
      this.redis.lpop(CONGREGATION_KEY).catch((err) => {
        console.error("[redis] CongregationStore.shift failed:", err instanceof Error ? err.message : err);
      });
    }
    return record;
  }

  first(): PrayerRecord | undefined {
    return this.records[0];
  }

  length(): number {
    return this.records.length;
  }

  all(): Iterable<PrayerRecord> {
    return this.records;
  }

  clear(): void {
    this.records.length = 0;
    this.redis.del(CONGREGATION_KEY).catch(() => {});
  }
}
