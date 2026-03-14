'use client'

import { useReadContract } from 'wagmi'
import { Address } from 'viem'
import { CONTRACT_ADDRESSES, VERSE_NFT_ABI, chainConfig } from '../lib/contracts'
import { EnsAddress } from './EnsAddress'

export function VerseOwner({ tokenId }: { tokenId: number }) {
  const { data: owner, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
    chainId: chainConfig.chainId,
  })

  if (isLoading) return <span className="text-gray-500 text-xs sm:text-sm">Loading...</span>
  if (error) return <span className="text-dao-gold font-mono text-xs sm:text-sm">Not yet minted</span>

  return (
    <EnsAddress
      address={owner as string}
      className="text-dao-gold font-mono text-xs sm:text-sm hover:text-dao-purple transition-colors"
    />
  )
}
