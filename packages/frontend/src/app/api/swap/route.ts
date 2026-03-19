import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { env } from '@/lib/env'
import { apiError, Errors, getTraceId } from '@/lib/errors'

const API_BASE = 'https://trade-api.gateway.uniswap.org/v1'
const ALLOWED_ENDPOINTS = ['/quote', '/swap', '/order', '/check_approval']

const SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET)

// Per-wallet rate limiting: 30 requests per 60s sliding window
const WALLET_WINDOW_MS = 60_000
const WALLET_MAX_REQUESTS = 30
const walletBuckets = new Map<string, number[]>()

// Cleanup stale wallet buckets every 60s
let lastWalletCleanup = Date.now()
function cleanupWalletBuckets(now: number) {
  if (now - lastWalletCleanup < 60_000) return
  lastWalletCleanup = now
  for (const [key, timestamps] of walletBuckets.entries()) {
    if (timestamps.length === 0) walletBuckets.delete(key)
  }
}

function walletRateLimit(wallet: string): boolean {
  const now = Date.now()
  cleanupWalletBuckets(now)

  const key = wallet.toLowerCase()
  let timestamps = walletBuckets.get(key)
  if (!timestamps) {
    timestamps = []
    walletBuckets.set(key, timestamps)
  }

  const cutoff = now - WALLET_WINDOW_MS
  const filtered = timestamps.filter(t => t > cutoff)
  walletBuckets.set(key, filtered)

  if (filtered.length >= WALLET_MAX_REQUESTS) return false
  filtered.push(now)
  return true
}

export async function POST(request: NextRequest) {
  const traceId = getTraceId(request)

  // --- JWT Authentication ---
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return apiError(401, Errors.AUTH_MISSING_TOKEN, undefined, undefined, traceId)
  }

  let wallet: string
  try {
    const { payload } = await jwtVerify(authHeader.split(' ')[1], SECRET_KEY)
    wallet = payload.sub as string
    if (!wallet) throw new Error('missing sub')
  } catch {
    return apiError(401, Errors.AUTH_INVALID_TOKEN, undefined, undefined, traceId)
  }

  // --- Per-wallet rate limiting ---
  if (!walletRateLimit(wallet)) {
    return apiError(429, Errors.RATE_LIMITED, { retryAfter: 60 }, { 'Retry-After': '60' }, traceId)
  }

  const apiKey = process.env.UNISWAP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ detail: 'Uniswap API key not configured' }, { status: 500 })
  }

  let body: { endpoint?: string; params?: object }
  try {
    body = await request.json()
  } catch {
    return apiError(400, Errors.INVALID_BODY, undefined, undefined, traceId)
  }

  const { endpoint, params } = body
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ detail: `Invalid endpoint: ${endpoint}` }, { status: 400 })
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(params),
  })

  const data = await res.json().catch(() => ({ detail: res.statusText }))

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status })
  }

  return NextResponse.json(data)
}
