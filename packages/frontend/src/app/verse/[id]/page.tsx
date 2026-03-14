import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import { getVerseById, verses } from '@/lib/verses'
import { VerseMintButton } from '@/components/VerseMintButton'
import { VerseOwner } from '@/components/VerseOwner'

export async function generateStaticParams() {
  return verses.map((verse) => ({
    id: String(verse.id)
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const verse = getVerseById(parseInt(id))
  
  if (!verse) {
    return {
      title: 'Verse Not Found | Dao DeGen',
      description: 'The requested verse was not found in the Dao DeGen collection.'
    }
  }

  return {
    title: `${verse.title} - Verse #${verse.id} | Dao DeGen`,
    description: `Read verse #${verse.id} "${verse.title}" from the Dao DeGen collection. Part of 81 unique NFTs with automated revenue sharing.`,
    openGraph: {
      title: verse.title,
      description: verse.alpha || verse.body.substring(0, 150) + '...',
      images: [verse.image],
    },
  }
}

export default async function VersePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const verseId = parseInt(id)
  const verse = getVerseById(verseId)

  if (!verse || verseId < 1 || verseId > 81) {
    return (
      <main className="min-h-screen container mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4">Verse Not Found</h1>
          <p className="text-gray-400 mb-8">There are only 81 verses in the Dao DeGen collection.</p>
          <Link 
            href="/verses" 
            className="bg-dao-purple hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Browse All Verses
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen container mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="mb-6 sm:mb-8">
        <Link 
          href="/verses" 
          className="text-dao-purple hover:text-dao-gold transition-colors inline-flex items-center gap-1 min-h-[44px] px-2 py-2"
        >
          ← Back to All Verses
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-12 px-2">
          <div className="text-dao-purple text-base sm:text-lg font-medium mb-2">
            Verse #{verse.id} of 81
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent leading-tight">
            {verse.title}
          </h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12">
          <div>
            <div className="w-full aspect-square rounded-lg mb-6 sm:mb-8 overflow-hidden relative bg-slate-700 max-w-md mx-auto lg:max-w-none">
              {verse.image ? (
                <Image
                  src={verse.image}
                  alt={`Artwork illustration for "${verse.title}", verse number ${verse.id} from the Dao DeGen collection`}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 flex-col">
                  <div className="text-4xl sm:text-6xl mb-4">📜</div>
                  <div className="text-sm sm:text-base">No artwork available</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 sm:p-8 mb-6 sm:mb-8">
              <pre className="text-base sm:text-lg leading-relaxed text-gray-200 whitespace-pre-wrap font-serif">
                {verse.body}
              </pre>
            </div>

            {verse.alpha && (
              <div className="bg-dao-purple/10 border border-dao-purple/30 rounded-lg p-6 mb-8">
                <h4 className="text-lg font-semibold mb-3 text-dao-gold">Alpha</h4>
                <p className="text-gray-200 leading-relaxed italic">
                  {verse.alpha}
                </p>
              </div>
            )}

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">NFT Information</h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm sm:text-base">Token ID:</span>
                  <span className="text-white text-sm sm:text-base">#{verse.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm sm:text-base">Fee Share:</span>
                  <span className="text-white text-sm sm:text-base">1/81 of total fees</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm sm:text-base">Owner:</span>
                  <VerseOwner tokenId={verse.id} />
                </div>
              </div>
              <div className="mt-4 sm:mt-6">
                <VerseMintButton verseId={verse.id} />
              </div>
            </div>

            <div className="mt-4 sm:mt-6">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 text-center sm:text-left">Share this verse:</h4>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <a
                  href={`https://twitter.com/intent/tweet?text=Check%20out%20"${encodeURIComponent(verse.title)}"%20from%20@daodegen&url=https://daodegen.com/verse/${verse.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium text-center min-h-[48px] flex items-center justify-center"
                  aria-label="Share on Twitter"
                >
                  🐦 Tweet
                </a>
                <a
                  href={`https://0xdead.church/?verse=${verse.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 bg-dao-purple hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium text-center min-h-[48px] flex items-center justify-center"
                >
                  Pray with this verse
                </a>
                <div className="px-4 py-3 bg-slate-700 text-white rounded-lg text-sm text-center min-h-[48px] flex items-center justify-center font-mono">
                  📱 daodegen.com/verse/{verse.id}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation - Improved Visibility */}
        <div className="flex justify-between mt-16 pt-8 border-t-2 border-dao-purple/30">
          {verseId > 1 ? (
            <Link 
              href={`/verse/${verseId - 1}`}
              className="bg-dao-purple/20 hover:bg-dao-purple/40 border border-dao-purple text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center gap-2"
              aria-label={`Go to previous verse ${verseId - 1}`}
            >
              <span className="text-xl">‹</span>
              <span>Previous</span>
            </Link>
          ) : (
            <div></div>
          )}
          
          {verseId < 81 ? (
            <Link 
              href={`/verse/${verseId + 1}`}
              className="bg-dao-purple/20 hover:bg-dao-purple/40 border border-dao-purple text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center gap-2"
              aria-label={`Go to next verse ${verseId + 1}`}
            >
              <span>Next</span>
              <span className="text-xl">›</span>
            </Link>
          ) : (
            <div></div>
          )}
        </div>

        {/* Close/Back Button */}
        <div className="text-center mt-8">
          <a
            href="/verses/"
            className="inline-flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 text-gray-300 hover:text-white py-2 px-4 rounded-lg transition-all duration-200"
          >
            <span className="text-lg">×</span>
            <span>Close</span>
          </a>
        </div>
      </div>
    </main>
  )
}