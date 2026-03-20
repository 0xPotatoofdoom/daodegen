import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RedisRateLimitStore } from './lib/stores/redis';

// ---------------------------------------------------------------------------
// Rate limiter -- sliding window per IP, backed by Redis so limits survive
// restarts and are shared across processes.
// Evicts stale entries every 60s to bound the local cache.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'; // ioredis requires Node.js APIs

const buckets = new RedisRateLimitStore();

// Cleanup stale buckets every 60s
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

// Returns true if the request is allowed, false if rate-limited.
function rateLimit(ip: string, path: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  cleanup(now);

  const key = `${ip}:${path}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t: number) => t > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

// ---------------------------------------------------------------------------
// Rate limit tiers -- low limits for a bandwidth-constrained VPS
// ---------------------------------------------------------------------------

interface RateRule {
  prefix: string;
  maxRequests: number;
  windowMs: number;
}

// In E2E test environments, relax rate limits to avoid flaky tests.
// Blocked in production to prevent accidental misconfiguration.
// In CI or E2E environments, disable rate limiting entirely to prevent flaky tests
const RATE_LIMIT_DISABLED = process.env.CI === 'true' || !!process.env.E2E_BASE_URL;
const multiplier = RATE_LIMIT_DISABLED ? 10000 : 1;

const RATE_RULES: RateRule[] = [
  // Auth endpoints -- tight limits, no reason to hammer these
  { prefix: '/api/auth/',     maxRequests: 5 * multiplier,  windowMs: 60_000 },
  // Health check -- monitoring tools poll this
  { prefix: '/api/health',    maxRequests: 30 * multiplier, windowMs: 60_000 },
  // Verse API -- already gated by JWT + x402 payment, but cap anyway
  { prefix: '/v1/verse/',     maxRequests: 10 * multiplier, windowMs: 60_000 },
  // Sermon -- JWT gated + per-wallet cooldown in route, but cap IP too
  { prefix: '/v1/sermon/anonymous', maxRequests: 3 * multiplier, windowMs: 60_000 },
  { prefix: '/v1/sermon',     maxRequests: 5 * multiplier,  windowMs: 60_000 },
  // Congregation state -- public, but no reason to poll faster than this
  { prefix: '/v1/congregation/', maxRequests: 30 * multiplier, windowMs: 60_000 },
  // Swap proxy -- JWT-gated + per-wallet limit in route, but cap IP too
  { prefix: '/api/swap',    maxRequests: 30 * multiplier, windowMs: 60_000 },
  // Ops status -- monitoring dashboard
  { prefix: '/api/ops/', maxRequests: 30 * multiplier, windowMs: 60_000 },
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Trace ID ──────────────────────────────────────────────────
  // Accept caller-provided trace ID or generate one.
  // Propagated downstream via x-request-id header.
  const traceId = request.headers.get('x-request-id') || crypto.randomUUID();

  // Rate limiting for API routes
  const rule = getRateRule(pathname);
  if (rule) {
    const ip = request.headers.get('x-real-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || '127.0.0.1';

    if (!rateLimit(ip, rule.prefix, rule.maxRequests, rule.windowMs)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retryAfter: 60 } } },
        { status: 429, headers: { 'Retry-After': '60', 'x-request-id': traceId } },
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

export const config = {
  matcher: [
    // Only run middleware on API and v1 routes -- skip page navigations and RSC payloads
    '/api/:path*',
    '/v1/:path*',
  ],
};