import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRedis } from './lib/stores/redis';

// ---------------------------------------------------------------------------
// Rate limiter — Redis-backed INCR + EXPIRE (survives restarts, works
// across multiple Next.js processes).  Follows the same pattern as the
// facilitator.  Falls open (allows request) if Redis is unreachable.
// Key format: ratelimit:middleware:<ip>:<route-prefix>
// ---------------------------------------------------------------------------

/**
 * Returns true if the request should be blocked (rate-limited).
 * Uses atomic INCR + EXPIRE in Redis — no in-memory state.
 */
async function isRateLimited(
  ip: string,
  routePrefix: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const redis = getRedis();
    const key = `ratelimit:middleware:${ip}:${routePrefix}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count > maxRequests;
  } catch (err) {
    // Fail open — if Redis is down, allow the request rather than blocking users
    console.error('[middleware] Redis rate-limit check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rate limit tiers -- low limits for a bandwidth-constrained VPS
// ---------------------------------------------------------------------------

interface RateRule {
  prefix: string;
  maxRequests: number;
  windowSeconds: number;
}

// In E2E test environments, relax rate limits to avoid flaky tests.
// Blocked in production to prevent accidental misconfiguration.
const multiplier = (process.env.E2E_BASE_URL && process.env.NODE_ENV !== 'production') ? 10 : 1;

const RATE_RULES: RateRule[] = [
  // Auth endpoints -- tight limits, no reason to hammer these
  { prefix: '/api/auth/',     maxRequests: 5 * multiplier,  windowSeconds: 60 },
  // Health check -- monitoring tools poll this
  { prefix: '/api/health',    maxRequests: 30 * multiplier, windowSeconds: 60 },
  // Verse API -- already gated by JWT + x402 payment, but cap anyway
  { prefix: '/v1/verse/',     maxRequests: 10 * multiplier, windowSeconds: 60 },
  // Sermon -- JWT gated + per-wallet cooldown in route, but cap IP too
  { prefix: '/v1/sermon/anonymous', maxRequests: 3 * multiplier, windowSeconds: 60 },
  { prefix: '/v1/sermon',     maxRequests: 5 * multiplier,  windowSeconds: 60 },
  // Congregation state -- public, but no reason to poll faster than this
  { prefix: '/v1/congregation/', maxRequests: 30 * multiplier, windowSeconds: 60 },
  // Ops status -- monitoring dashboard
  { prefix: '/api/ops/', maxRequests: 30 * multiplier, windowSeconds: 60 },
];

function getRateRule(pathname: string): RateRule | null {
  for (const rule of RATE_RULES) {
    if (pathname.startsWith(rule.prefix)) return rule;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Trace ID ──────────────────────────────────────────────────
  // Accept caller-provided trace ID or generate one.
  // Propagated downstream via x-request-id header.
  const traceId = request.headers.get('x-request-id') || crypto.randomUUID();

  // Rate limiting for API routes (Redis-backed, survives restarts)
  const rule = getRateRule(pathname);
  if (rule) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';

    if (await isRateLimited(ip, rule.prefix, rule.maxRequests, rule.windowSeconds)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retryAfter: rule.windowSeconds } } },
        { status: 429, headers: { 'Retry-After': String(rule.windowSeconds), 'x-request-id': traceId } },
      );
    }
  }

  // Forward trace ID to route handlers via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', traceId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Trace ID in response — agents/clients can use this for debugging
  response.headers.set('x-request-id', traceId);

  // Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const connectOrigins = [
    "'self'",
    // Public RPC endpoints
    'https://mainnet.unichain.org',
    'https://sepolia.unichain.org',
    'https://unichain.org',
    // Alchemy RPC (wildcard subdomain)
    'https://*.g.alchemy.com',
    // WalletConnect
    'wss://relay.walletconnect.org',
    'wss://relay.walletconnect.com',
    'https://*.walletconnect.com',
    'https://*.walletconnect.org',
  ];

  if (process.env.NODE_ENV !== 'production') {
    connectOrigins.push('http://localhost:*', 'ws://localhost:*');
  }

  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "frame-ancestors 'none'; " +
    `connect-src ${connectOrigins.join(' ')} https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com;`
  );
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return response;
}

// Use Node.js runtime so we can access ioredis (not available in Edge Runtime).
export const runtime = 'nodejs';

export const config = {
  matcher: [
    // Only run middleware on API and v1 routes -- skip page navigations and RSC payloads
    '/api/:path*',
    '/v1/:path*',
  ],
};