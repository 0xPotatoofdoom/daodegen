import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://trade-api.gateway.uniswap.org/v1'
const ALLOWED_ENDPOINTS = ['/quote', '/swap', '/order', '/check_approval']

export async function POST(request: NextRequest) {
  const apiKey = process.env.UNISWAP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ detail: 'Uniswap API key not configured' }, { status: 500 })
  }

  let body: { endpoint?: string; params?: object }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
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
