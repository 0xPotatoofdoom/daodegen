'use client'

import { useReadContract, useBalance } from 'wagmi'
import { formatEther, Address } from 'viem'
import { CONTRACT_ADDRESSES, VERSE_NFT_ABI, DAODEGEN_TOKEN_ABI, chainConfig } from '../lib/contracts'

interface TokenStats {
  nftsMinted: string
  jarBalance: string
  tokenTotalSupply: string
  totalNFTs: string
  isLoading: boolean
  error: string | null
}

export function useTokenStats(): TokenStats {
  const { data: nftSupply, isLoading: nftLoading, error: nftError } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'totalSupply',
    chainId: chainConfig.chainId,
  })

  const { data: tokenSupply, isLoading: tokenLoading, error: tokenError } = useReadContract({
    address: CONTRACT_ADDRESSES.DAODEGEN_TOKEN as Address,
    abi: DAODEGEN_TOKEN_ABI,
    functionName: 'totalSupply',
    chainId: chainConfig.chainId,
  })

  const { data: jarBal, isLoading: jarLoading, error: jarError } = useBalance({
    address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
    chainId: chainConfig.chainId,
  })

  const isLoading = nftLoading || tokenLoading || jarLoading
  const firstError = nftError || tokenError || jarError

  return {
    nftsMinted: nftSupply != null ? (nftSupply as bigint).toString() : '0',
    jarBalance: jarBal ? `${parseFloat(formatEther(jarBal.value)).toFixed(4)} ETH` : '0 ETH',
    tokenTotalSupply: tokenSupply != null
      ? `${(Number(tokenSupply as bigint) / 1e18).toLocaleString()} DDGEN`
      : '0 DDGEN',
    totalNFTs: '81',
    isLoading,
    error: firstError ? firstError.message : null,
  }
}
