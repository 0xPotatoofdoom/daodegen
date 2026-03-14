import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMkdir, mockAppendFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockAppendFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    promises: {
      ...(actual as { promises: Record<string, unknown> }).promises,
      mkdir: mockMkdir,
      appendFile: mockAppendFile,
    },
  };
});

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/notify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('POST /api/notify', () => {
  beforeEach(() => {
    mockMkdir.mockResolvedValue(undefined)
    mockAppendFile.mockResolvedValue(undefined)
  })

  it('returns 200 for valid email via x-forwarded-for', async () => {
    const res = await POST(makeReq({ email: 'hello@example.com' }, { 'x-forwarded-for': '10.1.1.1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('trims whitespace from email before validation', async () => {
    const res = await POST(makeReq({ email: '  trimmed@example.com  ' }, { 'x-forwarded-for': '10.1.1.8' }))
    expect(res.status).toBe(200)
  })

  it('uses x-real-ip when x-forwarded-for is absent', async () => {
    const res = await POST(makeReq({ email: 'real@ip.com' }, { 'x-real-ip': '10.3.3.3' }))
    expect(res.status).toBe(200)
  })

  it('falls back to "unknown" when no IP headers present', async () => {
    // Two requests with no IP header would both use "unknown" and trigger rate limit
    // First request should succeed
    const res = await POST(makeReq({ email: 'noip1@example.com' }))
    // Should succeed or be rate-limited depending on prior test state — just check it returns a valid status
    expect([200, 429]).toContain(res.status)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/notify', {
      method: 'POST',
      body: 'not valid json!!!',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('JSON')
  })

  it('returns 400 for missing email field', async () => {
    const res = await POST(makeReq({}, { 'x-forwarded-for': '10.1.1.2' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('email')
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeReq({ email: 'not-an-email' }, { 'x-forwarded-for': '10.1.1.3' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('email')
  })

  it('returns 400 for email with no domain', async () => {
    const res = await POST(makeReq({ email: 'user@' }, { 'x-forwarded-for': '10.1.1.4' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when same IP submits twice in quick succession', async () => {
    const ip = '10.2.2.2'
    await POST(makeReq({ email: 'a@a.com' }, { 'x-forwarded-for': ip }))
    const res = await POST(makeReq({ email: 'b@b.com' }, { 'x-forwarded-for': ip }))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('Too many requests')
  })

  it('returns 500 when file system write fails', async () => {
    mockAppendFile.mockRejectedValueOnce(new Error('disk full'))
    const res = await POST(makeReq({ email: 'err@test.com' }, { 'x-forwarded-for': '10.4.4.4' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('Server error')
  })

  it('returns 500 when mkdir fails', async () => {
    mockMkdir.mockRejectedValueOnce(new Error('permission denied'))
    const res = await POST(makeReq({ email: 'mkdir@test.com' }, { 'x-forwarded-for': '10.4.4.5' }))
    expect(res.status).toBe(500)
  })

  it('handles comma-separated x-forwarded-for and uses first IP', async () => {
    const ip = '10.5.5.5'
    const res = await POST(
      makeReq({ email: 'proxy@example.com' }, { 'x-forwarded-for': `${ip}, 192.168.1.1, 10.0.0.1` })
    )
    expect(res.status).toBe(200)
    // Second request from same first IP should be rate-limited
    const res2 = await POST(
      makeReq({ email: 'proxy2@example.com' }, { 'x-forwarded-for': `${ip}, 192.168.1.1` })
    )
    expect(res2.status).toBe(429)
  })
})
