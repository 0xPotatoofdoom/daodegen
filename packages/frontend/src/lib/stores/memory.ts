import type {
  NonceStore,
  RateBucket,
  RateLimitStore,
  PrayerRecord,
  CongregationStore,
  BroadcastEntry,
  BroadcastStore,
} from './types';

export class MemoryNonceStore implements NonceStore {
  private map = new Map<string, number>();
  get(nonce: string) { return this.map.get(nonce); }
  set(nonce: string, expiry: number) { this.map.set(nonce, expiry); }
  delete(nonce: string) { this.map.delete(nonce); }
  size() { return this.map.size; }
  entries() { return this.map.entries(); }
}

export class MemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, RateBucket>();
  get(key: string) { return this.map.get(key); }
  set(key: string, bucket: RateBucket) { this.map.set(key, bucket); }
  delete(key: string) { this.map.delete(key); }
  entries() { return this.map.entries(); }
}

export class MemoryCongregationStore implements CongregationStore {
  private records: PrayerRecord[] = [];
  push(record: PrayerRecord) { this.records.push(record); }
  shift() { return this.records.shift(); }
  first() { return this.records[0]; }
  length() { return this.records.length; }
  all() { return this.records; }
  clear() { this.records.length = 0; }
}

export class MemoryBroadcastStore implements BroadcastStore {
  private entries: BroadcastEntry[] = [];
  push(entry: BroadcastEntry) { this.entries.push(entry); }
  slice(start: number, end?: number) { return this.entries.slice(start, end); }
  length() { return this.entries.length; }
  all() { return this.entries; }
  clear() { this.entries.length = 0; }
  splice(start: number, deleteCount: number) { this.entries.splice(start, deleteCount); }
}
