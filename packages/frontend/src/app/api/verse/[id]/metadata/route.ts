import { NextRequest, NextResponse } from 'next/server'
import { getVerseById } from '@/lib/verses'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://daodegen.com'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const verseId = parseInt(id)

  if (isNaN(verseId) || verseId < 1 || verseId > 81) {
    return NextResponse.json(
      { error: 'Invalid verse ID. Must be 1-81.' },
      { status: 404 }
    )
  }

  const verse = getVerseById(verseId)
  if (!verse) {
    return NextResponse.json(
      { error: 'Verse not found.' },
      { status: 404 }
    )
  }

  const metadata = {
    name: `${verse.title} -- Verse #${verse.id}`,
    description: verse.alpha || verse.body.substring(0, 200),
    image: `${BASE_URL}${verse.image}`,
    external_url: `${BASE_URL}/verse/${verse.id}`,
    attributes: [
      {
        trait_type: 'Verse Number',
        display_type: 'number',
        value: verse.id,
      },
      {
        trait_type: 'Collection',
        value: 'Dao DeGen',
      },
      {
        trait_type: 'Source',
        value: 'Tao Te Ching (DeFi adaptation)',
      },
    ],
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
