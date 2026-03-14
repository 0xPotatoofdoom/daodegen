import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { PONDER_API_URL: 'http://ponder-test:42069' },
}))

import { GET } from './route'

describe('GET /api/ops/indexer-status', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Ensure NEXT_PUBLIC_UNICHAIN_RPC is unset so the route uses the default
    delete process.env.NEXT_PUBLIC_UNICHAIN_RPC
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockChainRpc(blockHex: string) {
    return {
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: blockHex }),
    }
  }

  function mockPonder(latestBlock: number) {
    return {
      ok: true,
      json: async () => ({ latestBlock }),
    }
  }

  it('returns status ok when lag is within 50 blocks', async () => {
    // chainBlock = 0x100 = 256, indexedBlock = 250, lag = 6
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockChainRpc('0x100') as any) // chain RPC
      .mockResolvedValueOnce(mockPonder(250) as any)       // ponder

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.chainBlock).toBe(256)
    expect(body.indexedBlock).toBe(250)
    expect(body.lag).toBe(6)
    expect(typeof body.timestamp).toBe('string')
  })

  it('returns status behind when lag exceeds 50 blocks', async () => {
    // chainBlock = 0x200 = 512, indexedBlock = 400, lag = 112
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockChainRpc('0x200') as any)
      .mockResolvedValueOnce(mockPonder(400) as any)

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('behind')
    expect(body.chainBlock).toBe(512)
    expect(body.indexedBlock).toBe(400)
    expect(body.lag).toBe(112)
  })

  it('returns status ok when lag is exactly 50 blocks', async () => {
    // chainBlock = 0x12c = 300, indexedBlock = 250, lag = 50
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockChainRpc('0x12c') as any)
      .mockResolvedValueOnce(mockPonder(250) as any)

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.lag).toBe(50)
  })

  it('returns status unavailable with null blocks when both fetches fail', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('unavailable')
    expect(body.indexedBlock).toBeNull()
    expect(body.chainBlock).toBeNull()
    expect(body.lag).toBeNull()
  })

  it('returns status unavailable when chain RPC fails but ponder succeeds', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('rpc down'))   // chain RPC throws
      .mockResolvedValueOnce(mockPonder(250) as any)  // ponder ok

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('unavailable')
    expect(body.chainBlock).toBeNull()
    // indexedBlock may be set but status must be unavailable since chainBlock is null
    expect(body.lag).toBeNull()
  })

  it('returns status unavailable when chain RPC returns non-ok', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as any)
      .mockResolvedValueOnce(mockPonder(250) as any)

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('unavailable')
    expect(body.chainBlock).toBeNull()
  })

  it('returns status unavailable when ponder returns non-ok', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockChainRpc('0x100') as any)
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as any)

    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('unavailable')
    expect(body.indexedBlock).toBeNull()
  })
})

// Separate describe block to test behaviour when PONDER_API_URL is not set
describe('GET /api/ops/indexer-status — no PONDER_API_URL', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('returns indexedBlock null immediately without fetching ponder', async () => {
    // Re-mock env with empty PONDER_API_URL for this suite
    vi.doMock('@/lib/env', () => ({ env: { PONDER_API_URL: '' } }))

    // Dynamic import to pick up the re-mocked env module
    const { GET: GETFresh } = await import('./route')

    vi.mocked(fetch).mockResolvedValue(
      { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x100' }) } as any
    )

    const res = await GETFresh()
    const body = await res.json()

    // Without PONDER_API_URL, getIndexedBlock returns null immediately
    expect(body.indexedBlock).toBeNull()
    expect(body.status).toBe('unavailable')
  })
})
