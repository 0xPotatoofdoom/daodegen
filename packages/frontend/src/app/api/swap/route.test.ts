import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SignJWT } from 'jose'
import { POST } from './route'

// Must match the JWT_SECRET injected by vitest.config.mts env block
const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET)

async function makeToken(sub = '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF') {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET_KEY)
}

function makeRequest(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return new Request('http://localhost/api/swap', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  })
}

describe('POST /api/swap', () => {
  beforeEach(() => {
    process.env.UNISWAP_API_KEY = 'test-key'
    process.env.JWT_SECRET = JWT_SECRET
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.UNISWAP_API_KEY
  })

  // ── Auth ─────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest({ endpoint: '/quote', params: {} })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_MISSING_TOKEN')
  })

  it('returns 401 when JWT is invalid', async () => {
    const req = makeRequest({ endpoint: '/quote', params: {} }, 'bad-token')
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  // ── Existing behaviour (now behind auth) ─────────────────────────

  it('returns 500 when UNISWAP_API_KEY is not set', async () => {
    delete process.env.UNISWAP_API_KEY
    const token = await makeToken()
    const req = makeRequest({ endpoint: '/quote', params: {} }, token)

    const res = await POST(req as any)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ detail: 'Uniswap API key not configured' })
  })

  it('returns 400 when body is invalid JSON', async () => {
    const token = await makeToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: 'not-valid-json',
      headers,
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when endpoint is missing', async () => {
    const token = await makeToken()
    const req = makeRequest({ params: { foo: 'bar' } }, token)

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when endpoint is not in the allowlist', async () => {
    const token = await makeToken()
    const req = makeRequest({ endpoint: '/admin', params: {} }, token)

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ detail: 'Invalid endpoint: /admin' })
  })

  it('returns 200 with upstream data when upstream responds ok', async () => {
    const upstreamData = { quote: { output: { amount: '1000' } } }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => upstreamData,
    } as any)

    const token = await makeToken()
    const req = makeRequest({ endpoint: '/quote', params: { foo: 'bar' } }, token)

    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(upstreamData)
  })

  it('forwards the upstream error status when upstream responds with an error', async () => {
    const errorData = { detail: 'Insufficient liquidity' }
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => errorData,
    } as any)

    const token = await makeToken()
    const req = makeRequest({ endpoint: '/swap', params: {} }, token)

    const res = await POST(req as any)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body).toEqual(errorData)
  })

  it('uses statusText as detail when upstream json parse fails on error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => { throw new Error('bad json') },
    } as any)

    const token = await makeToken()
    const req = makeRequest({ endpoint: '/check_approval', params: {} }, token)

    const res = await POST(req as any)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ detail: 'Service Unavailable' })
  })

  it('sends the request to the correct upstream URL with the api key header', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any)

    const token = await makeToken()
    const req = makeRequest({ endpoint: '/order', params: { order: 'data' } }, token)

    await POST(req as any)

    expect(fetch).toHaveBeenCalledWith(
      'https://trade-api.gateway.uniswap.org/v1/order',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
        body: JSON.stringify({ order: 'data' }),
      }),
    )
  })
})
