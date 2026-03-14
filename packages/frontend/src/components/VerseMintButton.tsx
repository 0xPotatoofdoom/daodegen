'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther, Address } from 'viem'
import { useState, useEffect } from 'react'
import { CONTRACT_ADDRESSES, VERSE_NFT_ABI, chainConfig } from '../lib/contracts'
import { EnsAddress } from './EnsAddress'

interface VerseMintButtonProps {
  verseId?: number
}

export function VerseMintButton({ verseId }: VerseMintButtonProps) {
  const { address, isConnected } = useAccount()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const { data: mintPrice, error: priceError } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'mintPrice',
    chainId: chainConfig.chainId,
  })

  const { data: priceIncrement } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'priceIncrement',
    chainId: chainConfig.chainId,
  })

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'totalSupply',
    chainId: chainConfig.chainId,
  })

  const { data: nextMintableTs } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'nextMintableTimestamp',
    args: address ? [address] : undefined,
    chainId: chainConfig.chainId,
    query: { enabled: !!address },
  })

  // If a specific verseId is provided, check whether it has already been minted.
  // ownerOf reverts for unminted tokens, so an error means "not yet minted".
  const { data: verseOwner, error: ownerError } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'ownerOf',
    args: verseId != null ? [BigInt(verseId)] : undefined,
    chainId: chainConfig.chainId,
    query: {
      enabled: verseId != null,
    },
  })

  if (priceError) {
    console.error('mintPrice read failed:', priceError.message)
  }

  const supply = totalSupply != null ? Number(totalSupply as bigint) : null
  const nextId = supply != null ? supply + 1 : null
  const isSoldOut = supply != null && supply >= 81
  const isVerseMinted = verseId != null && verseOwner != null && !ownerError
  const isNextToMint = verseId != null && nextId != null && verseId === nextId

  // Cooldown countdown
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)

  useEffect(() => {
    if (nextMintableTs == null) return
    const targetTs = Number(nextMintableTs as bigint)

    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000)
      const remaining = targetTs - nowSec
      setCooldownRemaining(remaining > 0 ? remaining : 0)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [nextMintableTs])

  const isOnCooldown = cooldownRemaining > 0

  const formatCooldown = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  // Next price after this mint
  const nextPrice = mintPrice != null && priceIncrement != null
    ? (mintPrice as bigint) + (priceIncrement as bigint)
    : null

  const handleMint = () => {
    if (mintPrice == null) return

    writeContract({
      address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
      abi: VERSE_NFT_ABI,
      functionName: 'mint',
      value: mintPrice as bigint,
    })
  }

  // -- Not connected --
  if (!isConnected) {
    return (
      <div className="text-center space-y-2">
        <ConnectButton />
        <p className="text-sm text-gray-400">Connect wallet to mint</p>
      </div>
    )
  }

  // -- Sold out --
  if (isSoldOut) {
    return (
      <div className="text-center space-y-2">
        <button
          disabled
          className="w-full bg-gray-600 text-gray-400 font-semibold py-3 px-6 rounded-lg cursor-not-allowed min-h-[48px] flex items-center justify-center"
        >
          All 81 verses have been minted
        </button>
      </div>
    )
  }

  // -- Verse-specific view: already minted --
  if (verseId != null && isVerseMinted) {
    return (
      <div className="space-y-2">
        <div className="w-full bg-slate-700 text-gray-300 font-semibold py-3 px-6 rounded-lg min-h-[48px] flex items-center justify-center text-center">
          This verse has been minted
        </div>
        <p className="text-xs text-gray-500 text-center">
          Held by{' '}
          <EnsAddress
            address={verseOwner as string}
            className="text-dao-gold hover:text-dao-purple transition-colors font-mono"
          />
        </p>
        {nextId != null && nextId <= 81 && (
          <p className="text-xs text-gray-500 text-center">
            <Link href={`/verse/${nextId}`} className="text-dao-purple hover:underline">
              Verse #{nextId} is next to mint
            </Link>
          </p>
        )}
      </div>
    )
  }

  // -- Verse-specific view: not yet minted, but not the next in sequence --
  if (verseId != null && !isVerseMinted && !isNextToMint && nextId != null) {
    return (
      <div className="space-y-2">
        <div className="w-full bg-slate-700 text-gray-300 font-semibold py-3 px-6 rounded-lg min-h-[48px] flex items-center justify-center text-center">
          Not yet available
        </div>
        <p className="text-xs text-gray-500 text-center">
          Minting is sequential.{' '}
          <Link href={`/verse/${nextId}`} className="text-dao-purple hover:underline">
            Verse #{nextId} is next to mint.
          </Link>
        </p>
        {totalSupply != null && (
          <p className="text-xs text-gray-500 text-center">
            {supply} / 81 minted
          </p>
        )}
      </div>
    )
  }

  // -- Mintable: either this IS the next verse, or no verseId was provided (generic) --
  const buttonLabel = isPending
    ? 'Confirm in Wallet...'
    : isConfirming
      ? 'Confirming...'
      : isOnCooldown
        ? `Cooldown: ${formatCooldown(cooldownRemaining)}`
        : mintPrice != null
          ? verseId != null
            ? `Mint Verse #${verseId} (${formatEther(mintPrice as bigint)} ETH)`
            : nextId != null
              ? `Mint Verse #${nextId} (${formatEther(mintPrice as bigint)} ETH)`
              : `Mint (${formatEther(mintPrice as bigint)} ETH)`
          : 'Loading price...'

  return (
    <div className="space-y-2">
      <button
        onClick={handleMint}
        disabled={isPending || isConfirming || mintPrice == null || isOnCooldown}
        className="w-full bg-dao-gold hover:bg-amber-600 text-dao-dark font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 min-h-[48px] flex items-center justify-center"
      >
        {buttonLabel}
      </button>

      {isOnCooldown && (
        <p className="text-xs text-amber-400 text-center">
          You can mint again in {formatCooldown(cooldownRemaining)}
        </p>
      )}

      {isConfirmed && (
        <div className="p-3 bg-green-900/30 border border-green-700 rounded text-sm text-center">
          Verse minted successfully.{' '}
          <Link href="/claim" className="text-dao-gold hover:underline">
            Claim fees
          </Link>
        </div>
      )}

      {writeError && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-sm text-center">
          {writeError.message.length > 100
            ? writeError.message.slice(0, 100) + '...'
            : writeError.message}
        </div>
      )}

      {totalSupply != null && (
        <p className="text-xs text-gray-500 text-center">
          {supply} / 81 minted
        </p>
      )}

      {nextPrice != null && (
        <p className="text-xs text-gray-500 text-center">
          Next mint price: {formatEther(nextPrice)} ETH
        </p>
      )}
    </div>
  )
}
