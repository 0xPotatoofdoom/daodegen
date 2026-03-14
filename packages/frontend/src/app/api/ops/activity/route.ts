import { NextResponse } from 'next/server';
import { fetchActivity } from '@/lib/ponder';

export const dynamic = 'force-dynamic';

export async function GET() {
  const events = await fetchActivity(50);

  if (!events) {
    return NextResponse.json(
      { error: 'Ponder unavailable', events: [] },
      { status: 503 },
    );
  }

  return NextResponse.json({ events });
}
