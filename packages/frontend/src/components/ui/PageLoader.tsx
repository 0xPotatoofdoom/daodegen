'use client'

import { useState, useEffect, ReactNode } from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import { PageLoadingSkeleton } from './SkeletonLoader'

interface PageLoaderProps {
  children: ReactNode
  skeleton?: ReactNode
  minLoadTime?: number
  className?: string
}

export function PageLoader({ 
  children, 
  skeleton, 
  minLoadTime = 500,
  className = '' 
}: PageLoaderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
      // Small delay to ensure smooth transition
      setTimeout(() => setShowContent(true), 100)
    }, minLoadTime)

    return () => clearTimeout(timer)
  }, [minLoadTime])

  if (isLoading) {
    return (
      <div className={`transition-opacity duration-300 ${className}`}>
        {skeleton || <PageLoadingSkeleton />}
      </div>
    )
  }

  return (
    <div className={`transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0'} ${className}`}>
      {children}
    </div>
  )
}

export function FullPageLoader({ 
  message = "Loading Dao DeGen...",
  showSpinner = true 
}: { 
  message?: string
  showSpinner?: boolean 
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dao-dark via-slate-900 to-dao-purple/20">
      <div className="text-center px-4">
        {showSpinner && <LoadingSpinner size="lg" className="mx-auto mb-4" />}
        <p className="text-lg text-gray-300">{message}</p>
        <div className="mt-2 text-sm text-gray-500">
          Please wait while we load the content...
        </div>
      </div>
    </div>
  )
}

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({ src, alt, className = '', onLoad, onError }: LazyImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleLoad = () => {
    setLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
    onError?.()
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-700/50 rounded">
          <LoadingSpinner size="sm" />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-700/50 rounded text-gray-500 text-sm">
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  )
}