import { getNonce } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const nonce = getNonce();
  return NextResponse.json({ nonce });
}