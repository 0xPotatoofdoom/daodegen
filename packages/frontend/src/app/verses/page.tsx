'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useMemo, Suspense } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import { Address } from 'viem'
import { verses } from '@/lib/verses'
import { CONTRACT_ADDRESSES, VERSE_NFT_ABI } from '../../lib/contracts'
import { Navigation } from '../../components/Navigation'
import { VerseCardSkeleton } from '../../components/ui/SkeletonLoader'
import { ErrorBoundary, LoadingErrorFallback } from '../../components/ui/ErrorBoundary'
import { PageLoader } from '../../components/ui/PageLoader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

function VersesPageContent() {
  const { address } = useAccount()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'id' | 'title'>('id')
  const [imagesLoading, setImagesLoading] = useState(true)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  const ownerCalls = useMemo(
    () =>
      Array.from({ length: 81 }, (_, i) => ({
        address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
        abi: VERSE_NFT_ABI,
        functionName: 'ownerOf' as const,
        args: [BigInt(i + 1)],
      })),
    [],
  )

  const { data: ownerResults } = useReadContracts({ contracts: ownerCalls })

  // Filter and sort verses based on search and sort options
  const filteredVerses = useMemo(() => {
    let filtered = verses.filter(verse => 
      verse.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      verse.body.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    return filtered.sort((a, b) => {
      if (sortBy === 'id') return a.id - b.id
      return a.title.localeCompare(b.title)
    })
  }, [searchQuery, sortBy])

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="text-center mb-12 sm:mb-16">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent leading-tight">
          81 Verses of DeFi Wisdom
        </h1>
        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto px-2">
          Explore the complete collection of Dao DeGen verses. Each verse is a unique NFT 
          that earns its holder a share of swap fees.
        </p>
      </div>

      {/* Search and Filter Controls - Improved Mobile */}
      <div className="mb-8 sm:mb-12 max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">Search verses</label>
            <input
              id="search"
              type="text"
              placeholder="Search verses by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-dao-purple focus:ring-2 focus:ring-dao-purple/20"
            />
          </div>
          <div>
            <label htmlFor="sort" className="sr-only">Sort verses</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'id' | 'title')}
              className="px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-dao-purple focus:ring-2 focus:ring-dao-purple/20"
            >
              <option value="id">Sort by Number</option>
              <option value="title">Sort by Title</option>
            </select>
          </div>
        </div>
        
        {/* Results count */}
        <div className="mt-4 text-center">
          <p className="text-gray-400">
            Showing {filteredVerses.length} of {verses.length} verses
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>
      </div>

      {/* Verse Grid - Better Mobile Layout with Loading States */}
      <ErrorBoundary fallback={<LoadingErrorFallback />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {filteredVerses.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400 text-lg">No verses found matching your search.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-dao-purple hover:text-dao-gold transition-colors min-h-[44px] px-4 py-2"
              >
                Clear search
              </button>
            </div>
          ) : (
            filteredVerses.map((verse) => {
              const result = ownerResults?.[verse.id - 1]
              const isMinted = result?.status === 'success'
              const owner = isMinted ? (result.result as string) : null
              const isOwner =
                isMinted &&
                owner &&
                address &&
                owner.toLowerCase() === address.toLowerCase()

              return (
          <Link
            key={verse.id}
            href={`/verse/${verse.id}`}
            className="group focus:outline-none focus:ring-2 focus:ring-dao-purple/50 rounded-lg min-h-[44px]"
            aria-label={`Read verse ${verse.id}: ${verse.title}`}
          >
            <div className={`bg-slate-800/50 border rounded-lg p-4 sm:p-6 hover:border-dao-purple/50 transition-colors duration-300 ${
              isOwner
                ? 'border-dao-gold'
                : isMinted
                  ? 'border-slate-700'
                  : 'border-slate-700'
            }`}>
              {/* Verse Artwork with Loading State */}
              <div className="w-full aspect-square rounded-lg mb-4 overflow-hidden relative bg-slate-700">
                {failedImages.has(verse.id) ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    <span>Image unavailable</span>
                  </div>
                ) : (
                  <Image
                    src={verse.image}
                    alt={`Artwork for ${verse.title}, verse number ${verse.id} of the Dao DeGen collection`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-all duration-300"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AoU+nsFKkkjkcbVjvx7MZqExPpqGXnrEaNu5Ny0ZSM6qvp8rKshLSpJKf/9k="
                    onLoad={() => setImagesLoading(false)}
                    onError={() => {
                      setFailedImages(prev => new Set(prev).add(verse.id))
                    }}
                  />
                )}
              </div>

              {/* Verse Info - Mobile Optimized */}
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 group-hover:text-dao-gold transition-colors line-clamp-2">
                {verse.title}
              </h3>

              <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 mb-3">
                {verse.body.split('\n').slice(0, 2).join('\n')}...
              </p>

              <div className="mt-3 sm:mt-4 flex justify-between items-center">
                <span className="text-dao-purple text-sm font-medium">
                  Verse #{verse.id}
                </span>
                <span className={`text-xs ${isOwner ? 'text-dao-gold font-semibold' : isMinted ? 'text-gray-500' : 'text-dao-purple'}`}>
                  {isOwner ? 'Yours' : isMinted ? 'Minted' : 'Available'}
                </span>
              </div>
            </div>
          </Link>
              )
            })
        )}
        </div>
      </ErrorBoundary>
      </div>
    </main>
  )
}

export default function VersesPage() {
  return (
    <PageLoader minLoadTime={200}>
      <Suspense fallback={
        <div className="min-h-screen">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-16">
              <div className="h-12 bg-slate-700/50 rounded w-96 mx-auto mb-4 animate-pulse" />
              <div className="h-6 bg-slate-700/50 rounded w-64 mx-auto animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <VerseCardSkeleton />
              <VerseCardSkeleton />
              <VerseCardSkeleton />
              <VerseCardSkeleton />
              <VerseCardSkeleton />
              <VerseCardSkeleton />
            </div>
          </div>
        </div>
      }>
        <VersesPageContent />
      </Suspense>
    </PageLoader>
  )
}