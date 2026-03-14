import { ImageResponse } from 'next/og'
import { getVerseById } from '@/lib/verses'

export const alt = 'Dao DeGen Verse'
export const size = { width: 1200, height: 675 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const verse = getVerseById(parseInt(id))

  if (!verse) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            fontSize: 48,
          }}
        >
          Verse Not Found
        </div>
      ),
      { ...size }
    )
  }

  const bodyPreview = verse.body.length > 200
    ? verse.body.substring(0, 200) + '...'
    : verse.body

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          padding: '48px 60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: '#a78bfa',
              fontWeight: 600,
            }}
          >
            Verse #{verse.id} of 81
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#fbbf24',
              fontWeight: 600,
            }}
          >
            Dao DeGen
          </div>
        </div>

        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: 24,
            lineHeight: 1.2,
          }}
        >
          {verse.title}
        </div>

        <div
          style={{
            fontSize: 22,
            color: '#94a3b8',
            lineHeight: 1.5,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {bodyPreview}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #334155',
            paddingTop: 20,
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 18, color: '#64748b' }}>
            daodegen.com/verse/{verse.id}
          </div>
          <div style={{ fontSize: 18, color: '#64748b' }}>
            81 Sacred Verses | DeFi Tao Te Ching
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
