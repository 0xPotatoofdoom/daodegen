import { NextResponse } from 'next/server';
import { getAllMetrics, getActiveProvider } from '@/lib/llm-metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const mem = process.memoryUsage();

  return NextResponse.json({
    node_env: process.env.NODE_ENV || 'development',
    node_version: process.version,
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    llm: {
      active_provider: getActiveProvider(),
      providers: getAllMetrics(),
    },
    env_config: {
      jwt_secret: !!process.env.JWT_SECRET,
      anthropic_api_key: !!process.env.ANTHROPIC_API_KEY,
      venice_api_key: !!process.env.VENICE_API_KEY,
      bankr_api_key: !!process.env.BANKR_API_KEY,
      redis_url: !!process.env.REDIS_URL,
      sentry_dsn: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      walletconnect_id: !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      facilitator_url: !!process.env.FACILITATOR_URL,
      ponder_api_url: !!process.env.PONDER_API_URL,
    },
  });
}
