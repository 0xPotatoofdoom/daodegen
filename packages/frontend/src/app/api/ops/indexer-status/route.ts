import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { chainConfig } from '@/lib/chain-config';

interface IndexerStatus {
  status: 'ok' | 'behind' | 'unavailable';
  indexedBlock: number | null;
  chainBlock: number | null;
  lag: number | null;
  timestamp: string;
}

async function getChainHead(): Promise<number | null> {
  const rpcUrl = process.env.NEXT_PUBLIC_UNICHAIN_RPC || chainConfig.rpcUrl;
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseInt(data.result, 16);
  } catch {
    return null;
  }
}

async function getIndexedBlock(): Promise<number | null> {
  if (!env.PONDER_API_URL) return null;
  try {
    const res = await fetch(`${env.PONDER_API_URL}/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.latestBlock ?? data.block ?? null;
  } catch {
    return null;
  }
}

const MAX_ACCEPTABLE_LAG = 50; // blocks

export async function GET() {
  const [chainBlock, indexedBlock] = await Promise.all([
    getChainHead(),
    getIndexedBlock(),
  ]);

  let status: IndexerStatus['status'] = 'unavailable';
  let lag: number | null = null;

  if (chainBlock != null && indexedBlock != null) {
    lag = chainBlock - indexedBlock;
    status = lag <= MAX_ACCEPTABLE_LAG ? 'ok' : 'behind';
  }

  const body: IndexerStatus = {
    status,
    indexedBlock,
    chainBlock,
    lag,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
