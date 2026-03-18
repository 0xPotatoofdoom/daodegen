import { NextResponse } from 'next/server';
import { chainConfig } from '@/lib/chain-config';

interface CheckResult {
  status: 'ok' | 'fail';
  latency_ms?: number;
  error?: string;
  provider?: string;
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

// Provider priority matches llm.ts: Venice → Bankr → Anthropic
const LLM_PROVIDERS = [
  { name: 'venice', envVar: 'VENICE_API_KEY' },
  { name: 'bankr', envVar: 'BANKR_API_KEY' },
  { name: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
] as const;

function checkLlmProvider(): CheckResult {
  for (const { name, envVar } of LLM_PROVIDERS) {
    if (process.env[envVar]) {
      console.log(`[health] active LLM provider: ${name} (${envVar})`);
      return { status: 'ok', provider: name };
    }
  }

  const checked = LLM_PROVIDERS.map((p) => p.envVar).join(', ');
  console.warn(`[health] no LLM provider key found (checked: ${checked})`);
  return { status: 'fail', error: `No LLM provider key set (checked: ${checked})` };
}

export async function GET() {
  const rpc = await checkRpc();
  const llm = checkLlmProvider();

  const checks = { rpc, llm };
  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
}
