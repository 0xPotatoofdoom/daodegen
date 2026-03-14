import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from './route'

describe('POST /api/swap', () => {
  beforeEach(() => {
    process.env.UNISWAP_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.UNISWAP_API_KEY
  })

  it('returns 500 when UNISWAP_API_KEY is not set', async () => {
    delete process.env.UNISWAP_API_KEY

    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ endpoint: '/quote', params: {} }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ detail: 'Uniswap API key not configured' })
  })

  it('returns 400 when body is invalid JSON', async () => {
    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: 'not-valid-json',
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ detail: 'Invalid JSON' })
  })

  it('returns 400 when endpoint is missing', async () => {
    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ params: { foo: 'bar' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ detail: 'Invalid endpoint: undefined' })
  })

  it('returns 400 when endpoint is not in the allowlist', async () => {
    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ endpoint: '/admin', params: {} }),
      headers: { 'Content-Type': 'application/json' },
    })

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

    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ endpoint: '/quote', params: { foo: 'bar' } }),
      headers: { 'Content-Type': 'application/json' },
    })

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

    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ endpoint: '/swap', params: {} }),
      headers: { 'Content-Type': 'application/json' },
    })

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

    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ endpoint: '/check_approval', params: {} }),
      headers: { 'Content-Type': 'application/json' },
    })

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

    const req = new Request('http://localhost/api/swap', {
      method: 'POST',
      body: JSON.stringify({ endpoint: '/order', params: { order: 'data' } }),
      headers: { 'Content-Type': 'application/json' },
    })

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
