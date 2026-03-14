'use client';

import React, { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';

// IPFS gateways in order of preference
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

interface IPFSImageProps extends Omit<ImageProps, 'src'> {
  /** IPFS hash or ipfs:// URI */
  hash: string;
  /** Fallback image URL (optional) */
  fallback?: string;
  /** Custom IPFS gateways (optional) */
  gateways?: string[];
  /** Loading placeholder component */
  loadingComponent?: React.ReactNode;
  /** Error placeholder component */
  errorComponent?: React.ReactNode;
}

/**
 * IPFSImage - Robust IPFS image loading with multiple gateway fallbacks
 * 
 * Features:
 * - Automatic gateway failover
 * - Loading states
 * - Error handling
 * - Performance monitoring
 * - Preload support
 */
export function IPFSImage({
  hash,
  fallback,
  gateways = IPFS_GATEWAYS,
  loadingComponent,
  errorComponent,
  alt,
  onLoad,
  onError,
  ...imageProps
}: IPFSImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  
  // Extract hash from ipfs:// URI if needed
  const cleanHash = hash.replace(/^ipfs:\/\//, '');
  
  // Generate IPFS URLs from gateways
  const ipfsUrls = gateways.map(gateway => `${gateway}${cleanHash}`);
  
  useEffect(() => {
    if (!cleanHash) {
      setHasError(true);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setHasError(false);
    setGatewayIndex(0);
    setCurrentSrc(ipfsUrls[0]);
  }, [cleanHash]);
  
  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setHasError(false);
    
    // Log successful gateway for monitoring
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ IPFS image loaded from gateway ${gatewayIndex + 1}:`, currentSrc);
    }
    
    onLoad?.(event);
  };
  
  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const nextIndex = gatewayIndex + 1;
    
    if (nextIndex < ipfsUrls.length) {
      // Try next gateway
      setGatewayIndex(nextIndex);
      setCurrentSrc(ipfsUrls[nextIndex]);
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  IPFS gateway ${gatewayIndex + 1} failed, trying gateway ${nextIndex + 1}`);
      }
    } else if (fallback) {
      // All gateways failed, try fallback
      setCurrentSrc(fallback);
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  All IPFS gateways failed, using fallback: ${fallback}`);
      }
    } else {
      // Complete failure
      setIsLoading(false);
      setHasError(true);
      
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ All IPFS gateways and fallback failed for hash: ${cleanHash}`);
      }
      
      onError?.(event);
    }
  };
  
  // Show loading state
  if (isLoading && loadingComponent) {
    return <>{loadingComponent}</>;
  }
  
  // Show error state
  if (hasError) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    
    // Default error placeholder
    return (
      <div 
        className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400"
        style={{ 
          width: imageProps.width || 400, 
          height: imageProps.height || 300 
        }}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">🖼️</div>
          <div className="text-sm">Image unavailable</div>
        </div>
      </div>
    );
  }
  
  return (
    <Image
      {...imageProps}
      src={currentSrc}
      alt={alt}
      onLoad={handleImageLoad}
      onError={handleImageError}
      // Add loading optimization
      loading={imageProps.loading || 'lazy'}
      // Add performance hints
      decoding="async"
    />
  );
}

/**
 * Hook for preloading IPFS images
 */
export function useIPFSImagePreload(hash: string, gateways = IPFS_GATEWAYS) {
  const [preloadStatus, setPreloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  useEffect(() => {
    if (!hash) return;
    
    const cleanHash = hash.replace(/^ipfs:\/\//, '');
    const ipfsUrls = gateways.map(gateway => `${gateway}${cleanHash}`);
    
    setPreloadStatus('loading');
    
    // Try to preload from fastest gateway
    const preloadImage = (urls: string[], index = 0): void => {
      if (index >= urls.length) {
        setPreloadStatus('error');
        return;
      }
      
      const img = new window.Image();
      
      img.onload = () => {
        setPreloadStatus('success');
      };
      
      img.onerror = () => {
        preloadImage(urls, index + 1);
      };
      
      img.src = urls[index];
    };
    
    preloadImage(ipfsUrls);
  }, [hash, gateways]);
  
  return preloadStatus;
}

export default IPFSImage;