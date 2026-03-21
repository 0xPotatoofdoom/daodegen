/** Store interfaces -- swap implementations to Redis/Valkey later. */

export interface NonceStore {
  get(nonce: string): number | undefined;
  set(nonce: string, expiry: number): void;
  delete(nonce: string): void;
  size(): number;
  entries(): Iterable<[string, number]>;
}

export interface RateBucket {
  timestamps: number[];
}

export interface RateLimitStore {
  get(key: string): RateBucket | undefined;
  set(key: string, bucket: RateBucket): void;
  delete(key: string): void;
  entries(): Iterable<[string, RateBucket]>;
}

export interface PrayerRecord {
  sender: string;
  sentimentTag: string;
  timestamp: number;
}

export interface CongregationStore {
  push(record: PrayerRecord): void;
  shift(): PrayerRecord | undefined;
  first(): PrayerRecord | undefined;
  length(): number;
  all(): Iterable<PrayerRecord>;
  clear(): void;
}

export interface BroadcastEntry {
  id: string;
  message: string;
  verseNumber: number;
  agentAddress: string;
  timestamp: string;
  isAgent: boolean;
}

export interface BroadcastStore {
  push(entry: BroadcastEntry): void;
  slice(start: number, end?: number): BroadcastEntry[];
  length(): number;
  all(): BroadcastEntry[];
  clear(): void;
  splice(start: number, deleteCount: number): void;
}
