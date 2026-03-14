import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_MS = 60 * 60 * 1000 // 1 hour
const ipTimestamps = new Map<string, number>()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req)
  const now = Date.now()
  const lastRequest = ipTimestamps.get(ip)
  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429 },
    )
  }

  // Parse body
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const email = body.email?.trim()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  // Append to file
  const filePath = path.join(process.cwd(), 'data', 'notify-emails.jsonl')
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const line = JSON.stringify({ email, ts: new Date().toISOString(), ip }) + '\n'
    await fs.appendFile(filePath, line, 'utf-8')
  } catch (err) {
    console.error('Failed to write email signup:', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }

  ipTimestamps.set(ip, now)

  return NextResponse.json({ ok: true })
}
