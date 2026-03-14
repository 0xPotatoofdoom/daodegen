'use client'

import { useTokenStats } from '../hooks/useTokenStats'
import { ErrorBoundary, LoadingErrorFallback } from './ui/ErrorBoundary'
import { StatCardSkeleton } from './ui/SkeletonLoader'

export function StatsBar() {
  const { nftsMinted, jarBalance, tokenTotalSupply, totalNFTs, isLoading, error } = useTokenStats()

  return (
    <div className="container mx-auto px-4 sm:px-6 pb-12">
      <ErrorBoundary fallback={<LoadingErrorFallback />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {error ? (
            <div className="col-span-full text-center py-8">
              <p className="text-red-400 mb-2">Failed to load stats</p>
              <p className="text-gray-500 text-sm">
                Data will be available once contracts are deployed
              </p>
            </div>
          ) : isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-dao-gold mb-1">
                  {nftsMinted} / 81
                </div>
                <div className="text-sm text-gray-400">NFTs Minted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-dao-gold mb-1">
                  {jarBalance}
                </div>
                <div className="text-sm text-gray-400">Fees in Jar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-dao-gold mb-1">
                  {tokenTotalSupply}
                </div>
                <div className="text-sm text-gray-400">Token Supply</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-dao-gold mb-1">
                  {totalNFTs}
                </div>
                <div className="text-sm text-gray-400">Verses</div>
              </div>
            </>
          )}
        </div>
      </ErrorBoundary>
    </div>
  )
}
