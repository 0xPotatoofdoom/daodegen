import { describe, it, expect, beforeEach } from 'vitest'
import {
  MemoryNonceStore,
  MemoryRateLimitStore,
  MemoryCongregationStore,
} from './memory'
import type { PrayerRecord, RateBucket } from './types'

// ---------------------------------------------------------------------------
// MemoryNonceStore
// ---------------------------------------------------------------------------

describe('MemoryNonceStore', () => {
  let store: MemoryNonceStore

  beforeEach(() => {
    store = new MemoryNonceStore()
  })

  it('returns undefined for a key that has not been set', () => {
    expect(store.get('missing')).toBeUndefined()
  })

  it('stores and retrieves a nonce expiry', () => {
    store.set('nonce-1', 1700000000)
    expect(store.get('nonce-1')).toBe(1700000000)
  })

  it('overwrites an existing nonce', () => {
    store.set('nonce-1', 1700000000)
    store.set('nonce-1', 1800000000)
    expect(store.get('nonce-1')).toBe(1800000000)
  })

  it('deletes a nonce', () => {
    store.set('nonce-1', 1700000000)
    store.delete('nonce-1')
    expect(store.get('nonce-1')).toBeUndefined()
  })

  it('delete on a non-existent key does not throw', () => {
    expect(() => store.delete('ghost')).not.toThrow()
  })

  it('size returns the number of stored nonces', () => {
    expect(store.size()).toBe(0)
    store.set('a', 1)
    store.set('b', 2)
    expect(store.size()).toBe(2)
    store.delete('a')
    expect(store.size()).toBe(1)
  })

  it('entries iterates over all stored nonces', () => {
    store.set('n1', 100)
    store.set('n2', 200)

    const result = new Map(store.entries())
    expect(result.get('n1')).toBe(100)
    expect(result.get('n2')).toBe(200)
    expect(result.size).toBe(2)
  })

  it('entries returns empty iterable when store is empty', () => {
    const result = Array.from(store.entries())
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// MemoryRateLimitStore
// ---------------------------------------------------------------------------

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore

  beforeEach(() => {
    store = new MemoryRateLimitStore()
  })

  const bucket = (timestamps: number[]): RateBucket => ({ timestamps })

  it('returns undefined for a key that has not been set', () => {
    expect(store.get('ip-1')).toBeUndefined()
  })

  it('stores and retrieves a rate bucket', () => {
    const b = bucket([1000, 2000])
    store.set('ip-1', b)
    expect(store.get('ip-1')).toEqual(b)
  })

  it('overwrites an existing bucket', () => {
    store.set('ip-1', bucket([1000]))
    const updated = bucket([1000, 2000, 3000])
    store.set('ip-1', updated)
    expect(store.get('ip-1')).toEqual(updated)
  })

  it('deletes a bucket', () => {
    store.set('ip-1', bucket([1000]))
    store.delete('ip-1')
    expect(store.get('ip-1')).toBeUndefined()
  })

  it('delete on a non-existent key does not throw', () => {
    expect(() => store.delete('ghost')).not.toThrow()
  })

  it('entries iterates over all stored buckets', () => {
    const b1 = bucket([1000])
    const b2 = bucket([2000, 3000])
    store.set('ip-1', b1)
    store.set('ip-2', b2)

    const result = new Map(store.entries())
    expect(result.get('ip-1')).toEqual(b1)
    expect(result.get('ip-2')).toEqual(b2)
    expect(result.size).toBe(2)
  })

  it('entries returns empty iterable when store is empty', () => {
    expect(Array.from(store.entries())).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// MemoryCongregationStore
// ---------------------------------------------------------------------------

describe('MemoryCongregationStore', () => {
  let store: MemoryCongregationStore

  const record = (sender: string, tag = 'gratitude', ts = 1000): PrayerRecord => ({
    sender,
    sentimentTag: tag,
    timestamp: ts,
  })

  beforeEach(() => {
    store = new MemoryCongregationStore()
  })

  it('length returns 0 for an empty store', () => {
    expect(store.length()).toBe(0)
  })

  it('push appends a record and increases length', () => {
    store.push(record('alice'))
    expect(store.length()).toBe(1)
    store.push(record('bob'))
    expect(store.length()).toBe(2)
  })

  it('first returns undefined when the store is empty', () => {
    expect(store.first()).toBeUndefined()
  })

  it('first returns the first record without removing it', () => {
    store.push(record('alice'))
    store.push(record('bob'))
    expect(store.first()?.sender).toBe('alice')
    expect(store.length()).toBe(2)
  })

  it('shift removes and returns the first record in FIFO order', () => {
    store.push(record('alice'))
    store.push(record('bob'))

    const popped = store.shift()
    expect(popped?.sender).toBe('alice')
    expect(store.length()).toBe(1)
    expect(store.first()?.sender).toBe('bob')
  })

  it('shift returns undefined when the store is empty', () => {
    expect(store.shift()).toBeUndefined()
  })

  it('all returns all records without removing them', () => {
    store.push(record('alice'))
    store.push(record('bob'))

    const all = Array.from(store.all())
    expect(all).toHaveLength(2)
    expect(all[0].sender).toBe('alice')
    expect(all[1].sender).toBe('bob')
    // nothing removed
    expect(store.length()).toBe(2)
  })

  it('all returns empty array for an empty store', () => {
    expect(Array.from(store.all())).toHaveLength(0)
  })

  it('clear removes all records', () => {
    store.push(record('alice'))
    store.push(record('bob'))
    store.clear()
    expect(store.length()).toBe(0)
    expect(store.first()).toBeUndefined()
  })

  it('clear on an already empty store does not throw', () => {
    expect(() => store.clear()).not.toThrow()
  })

  it('maintains insertion order across push, shift, and all', () => {
    store.push(record('alice', 'joy', 1))
    store.push(record('bob', 'peace', 2))
    store.push(record('carol', 'hope', 3))

    store.shift() // remove alice

    const all = Array.from(store.all())
    expect(all.map((r) => r.sender)).toEqual(['bob', 'carol'])
  })
})
