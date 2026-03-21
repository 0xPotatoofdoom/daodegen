import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createCipheriv, randomBytes } from 'node:crypto'
import { createRateLimitStore } from '../../../lib/stores'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_MS = 60 * 60 * 1000 // 1 hour

// Use Redis-backed store when available, else in-memory
const rateLimitStore = createRateLimitStore()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Encrypt a JSON line with AES-256-GCM.
 *
 * Format per line (all base64): iv:authTag:ciphertext
 * To decrypt: split on ':', base64-decode each part, then
 *   decipher = createDecipheriv('aes-256-gcm', keyBuf, iv)
 *   decipher.setAuthTag(authTag)
 *   plaintext = decipher.update(ciphertext) + decipher.final()
 */
function encryptLine(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req)
  const now = Date.now()
  const bucket = rateLimitStore.get(`notify:${ip}`)
  if (bucket && bucket.timestamps.length > 0) {
    const lastRequest = bucket.timestamps[bucket.timestamps.length - 1]
    if (now - lastRequest < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 },
      )
    }
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

  // Encrypt + persist
  const encryptionKey = process.env.NOTIFY_ENCRYPTION_KEY
  const record = JSON.stringify({ email, ts: new Date().toISOString(), ip })

  if (encryptionKey) {
    // Write encrypted entry to .enc.jsonl
    const encPath = path.join(process.cwd(), 'data', 'notify-emails.enc.jsonl')
    try {
      await fs.mkdir(path.dirname(encPath), { recursive: true })
      const encLine = encryptLine(record, encryptionKey) + '\n'
      await fs.appendFile(encPath, encLine, 'utf-8')
    } catch (err) {
      console.error('Failed to write encrypted email signup:', err)
      return NextResponse.json({ error: 'Server error.' }, { status: 500 })
    }
  } else {
    console.warn('[notify] NOTIFY_ENCRYPTION_KEY not set — skipping email storage. Set a 32-byte hex key to enable.')
  }

  rateLimitStore.set(`notify:${ip}`, { timestamps: [now] })

  return NextResponse.json({ ok: true })
}
