import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryNonceStore, MemoryRateLimitStore, MemoryCongregationStore } from './memory';
import { createNonceStore, createRateLimitStore, createCongregationStore } from './index';

describe('store factory functions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('without REDIS_URL (default)', () => {
    it('createNonceStore returns MemoryNonceStore', () => {
      vi.stubEnv('REDIS_URL', '');
      const store = createNonceStore();
      expect(store).toBeInstanceOf(MemoryNonceStore);
    });

    it('createRateLimitStore returns MemoryRateLimitStore', () => {
      vi.stubEnv('REDIS_URL', '');
      const store = createRateLimitStore();
      expect(store).toBeInstanceOf(MemoryRateLimitStore);
    });

    it('createCongregationStore returns MemoryCongregationStore', () => {
      vi.stubEnv('REDIS_URL', '');
      const store = createCongregationStore();
      expect(store).toBeInstanceOf(MemoryCongregationStore);
    });
  });

  describe('memory stores implement correct interface', () => {
    it('nonce store has expected methods', () => {
      const store = createNonceStore();
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.delete).toBe('function');
    });

    it('rate limit store has expected methods', () => {
      const store = createRateLimitStore();
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.delete).toBe('function');
    });

    it('congregation store has expected methods', () => {
      const store = createCongregationStore();
      expect(typeof store.push).toBe('function');
      expect(typeof store.shift).toBe('function');
      expect(typeof store.first).toBe('function');
      expect(typeof store.length).toBe('function');
      expect(typeof store.all).toBe('function');
      expect(typeof store.clear).toBe('function');
    });
  });
});
