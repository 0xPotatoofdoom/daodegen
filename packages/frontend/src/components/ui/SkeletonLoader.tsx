'use client'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-slate-700/50 rounded ${className}`}
      aria-hidden="true"
    />
  )
}

export function VerseCardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 sm:p-6">
      {/* Image skeleton */}
      <Skeleton className="w-full aspect-square rounded-lg mb-4" />
      
      {/* Title skeleton */}
      <Skeleton className="h-6 w-3/4 mb-2" />
      
      {/* Body text skeleton */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      
      {/* Footer skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="text-center">
      <Skeleton className="h-10 w-16 mx-auto mb-2" />
      <Skeleton className="h-4 w-20 mx-auto" />
    </div>
  )
}

export function HeroImageSkeleton() {
  return (
    <Skeleton className="w-full aspect-square rounded-lg" />
  )
}

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Navigation skeleton */}
      <div className="container mx-auto px-4 py-6 flex justify-between items-center">
        <Skeleton className="h-8 w-32" />
        <div className="hidden md:flex items-center space-x-6">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Hero section skeleton */}
      <div className="container mx-auto px-4 py-12 text-center">
        <Skeleton className="h-20 w-80 mx-auto mb-6" />
        <Skeleton className="h-8 w-96 mx-auto mb-4" />
        <Skeleton className="h-6 w-64 mx-auto mb-12" />
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto mb-16">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    </div>
  )
}