/**
 * Thin REST client for the Ponder indexer API.
 *
 * Ponder runs on the same VPS (localhost:42069) and is not publicly exposed.
 * All fetching happens server-side in Next.js API routes.
 */
import { env } from './env';

export interface PrayerStats {
  count: number;
  totalBurned: string;
}

export interface FeeRelease {
  id: string;
  caller: string;
  burnAmount: string;
  nftHolders: string;
  txHash: string;
  timestamp: string;
}

export interface NftHolders {
  [tokenId: string]: string;
}

async function ponderFetch<T>(path: string): Promise<T | null> {
  if (!env.PONDER_API_URL) return null;
  try {
    const res = await fetch(`${env.PONDER_API_URL}${path}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface Prayer {
  id: string;
  sender: string;
  amount: string;
  message: string;
  txHash: string;
  blockNumber: string;
  timestamp: string;
}

export async function fetchPrayerByTxHash(txHash: string, sender?: string) {
  const query = sender ? `?sender=${encodeURIComponent(sender)}` : '';
  return ponderFetch<Prayer>(`/prayers/tx/${encodeURIComponent(txHash)}${query}`);
}

export async function fetchPrayerStats() {
  return ponderFetch<PrayerStats>('/prayers/stats');
}

export async function fetchRecentFees(limit = 10) {
  return ponderFetch<FeeRelease[]>(`/fees/recent?limit=${limit}`);
}

export async function fetchNftHolders() {
  return ponderFetch<NftHolders>('/nfts/holders');
}

export interface NftMint {
  id: string;
  minter: string;
  tokenId: string;
  txHash: string;
  timestamp: string;
}

export interface ActivityEvent {
  type: 'mint' | 'claim' | 'fee_release' | 'prayer';
  timestamp: string;
  txHash: string;
  blockNumber: string;
  details: Record<string, string>;
}

export async function fetchRecentMints(limit = 20) {
  return ponderFetch<NftMint[]>(`/mints/recent?limit=${limit}`);
}

export async function fetchActivity(limit = 50) {
  return ponderFetch<ActivityEvent[]>(`/activity?limit=${limit}`);
}
