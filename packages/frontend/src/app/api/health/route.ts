import { NextResponse } from 'next/server';
import { chainConfig } from '@/lib/chain-config';

interface CheckResult {
  status: 'ok' | 'fail';
  latency_ms?: number;
  error?: string;
}

async function checkRpc(): Promise<CheckResult> {
  const rpcUrl = process.env.NEXT_PUBLIC_UNICHAIN_RPC || chainConfig.rpcUrl;
  const start = Date.now();
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { status: 'fail', latency_ms: Date.now() - start, error: `HTTP ${res.status}` };
    }
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'fail', latency_ms: Date.now() - start, error: String(err) };
  }
}


function checkAnthropic(): CheckResult {
  return process.env.ANTHROPIC_API_KEY
    ? { status: 'ok' }
    : { status: 'fail', error: 'ANTHROPIC_API_KEY not set' };
}

export async function GET() {
  const rpc = await checkRpc();
  const anthropic = checkAnthropic();

  const checks = { rpc, anthropic };
  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
}