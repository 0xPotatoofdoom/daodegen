'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatEther, Address, zeroAddress, Log } from 'viem'
import { useState, useEffect, useMemo } from 'react'
import { Navigation } from '../../components/Navigation'
import { CONTRACT_ADDRESSES, VERSE_NFT_ABI, chainConfig } from '../../lib/contracts'
import { verses } from '@/lib/verses'

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null)

  const {
    writeContract,
    data: mintHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: mintHash })

  // Read mint price (computed from bonding curve)
  const { data: mintPrice } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'mintPrice',
    chainId: chainConfig.chainId,
  })

  // Read price increment for display
  const { data: priceIncrement } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'priceIncrement',
    chainId: chainConfig.chainId,
  })

  // Read total supply
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'totalSupply',
    chainId: chainConfig.chainId,
  })

  // Read cooldown info for connected wallet
  const { data: nextMintableTs } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'nextMintableTimestamp',
    args: address ? [address] : undefined,
    chainId: chainConfig.chainId,
    query: { enabled: !!address },
  })

  // Check ownership of each verse (1-81) to build availability grid
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

  const { data: ownerResults, refetch: refetchOwners } = useReadContracts({
    contracts: ownerCalls,
  })

  // Parse the Transfer event log from the mint receipt to find the tokenId
  useEffect(() => {
    if (!receipt) return
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    const transferLog = receipt.logs.find(
      (log: Log) =>
        log.address.toLowerCase() === CONTRACT_ADDRESSES.VERSE_NFT.toLowerCase() &&
        log.topics[0] === transferTopic &&
        log.topics[1] === ('0x' + zeroAddress.slice(2).padStart(64, '0')),
    )
    if (transferLog?.topics[3]) {
      setMintedTokenId(BigInt(transferLog.topics[3]))
      refetchSupply()
      refetchOwners()
    }
  }, [receipt, refetchSupply, refetchOwners])

  const isSoldOut = totalSupply != null && (totalSupply as bigint) >= 81n
  const supply = totalSupply != null ? Number(totalSupply as bigint) : null

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
    resetWrite()
    setMintedTokenId(null)
    writeContract({
      address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
      abi: VERSE_NFT_ABI,
      functionName: 'mint',
      value: mintPrice as bigint,
    })
  }

  const mintedVerse = mintedTokenId
    ? verses.find((v) => v.id === Number(mintedTokenId))
    : null

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent">
              Mint a Verse NFT
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              81 verses. 81 NFTs. Each earns 1/81 of all swap fees for as long as the pool is active.
            </p>
            {supply != null && supply < 81 && (
              <p className="text-base text-dao-gold mt-3">
                Next verse: #{supply + 1}
              </p>
            )}
            {supply != null && supply >= 81 && (
              <p className="text-base text-gray-500 mt-3">
                All 81 verses have been minted
              </p>
            )}
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-dao-gold">
                {supply != null ? `${supply} / 81` : '...'}
              </div>
              <div className="text-sm text-gray-400">Minted</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-dao-gold">
                {supply != null ? 81 - supply : '...'}
              </div>
              <div className="text-sm text-gray-400">Available</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-dao-gold">
                {mintPrice != null
                  ? `${formatEther(mintPrice as bigint)} ETH`
                  : '...'}
              </div>
              <div className="text-sm text-gray-400">Current Price</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-dao-gold">
                {nextPrice != null
                  ? `${formatEther(nextPrice)} ETH`
                  : '...'}
              </div>
              <div className="text-sm text-gray-400">Next Price</div>
            </div>
          </div>

          {/* Bonding curve info */}
          {priceIncrement != null && (priceIncrement as bigint) > 0n && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-8 text-center">
              <p className="text-sm text-gray-400">
                Price increases by{' '}
                <span className="text-dao-gold font-semibold">
                  {formatEther(priceIncrement as bigint)} ETH
                </span>{' '}
                after each mint (bonding curve).
                {isOnCooldown && isConnected && (
                  <span className="text-amber-400 ml-2">
                    Cooldown active -- you can mint again in {formatCooldown(cooldownRemaining)}.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Mint action */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
            {!isConnected ? (
              <div className="text-center space-y-4">
                <p className="text-gray-400">Connect your wallet to mint</p>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            ) : isSoldOut ? (
              <div className="text-center py-4">
                <p className="text-xl font-semibold text-gray-400">
                  All 81 verses have been minted
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Check secondary markets or the{' '}
                  <Link href="/claim" className="text-dao-gold hover:underline">
                    claim page
                  </Link>{' '}
                  if you already hold one.
                </p>
              </div>
            ) : isConfirmed && mintedVerse ? (
              <div className="text-center space-y-4">
                <div className="text-green-400 text-lg font-semibold">
                  You minted Verse #{mintedVerse.id}
                </div>
                <div className="text-2xl font-bold text-white">
                  &ldquo;{mintedVerse.title}&rdquo;
                </div>
                <p className="text-gray-400 text-sm max-w-lg mx-auto">
                  This NFT earns 1/81 of all $DAODEGEN swap fees. Head to the
                  claim page to release and withdraw accumulated fees.
                </p>
                <div className="flex justify-center gap-4">
                  <Link
                    href={`/verse/${mintedVerse.id}`}
                    className="bg-dao-purple hover:bg-purple-700 text-white font-semibold py-2 px-5 rounded-lg transition-colors"
                  >
                    View Verse
                  </Link>
                  <Link
                    href="/claim"
                    className="bg-dao-gold hover:bg-amber-600 text-dao-dark font-semibold py-2 px-5 rounded-lg transition-colors"
                  >
                    Claim Fees
                  </Link>
                  <button
                    onClick={handleMint}
                    disabled={isOnCooldown}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isOnCooldown ? `Cooldown: ${formatCooldown(cooldownRemaining)}` : 'Mint Another'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <button
                  onClick={handleMint}
                  disabled={isPending || isConfirming || mintPrice == null || isOnCooldown}
                  className="bg-dao-gold hover:bg-amber-600 text-dao-dark font-bold py-3 px-8 rounded-lg text-lg transition-colors disabled:opacity-50"
                >
                  {isPending
                    ? 'Confirm in Wallet...'
                    : isConfirming
                      ? 'Confirming...'
                      : isOnCooldown
                        ? `Cooldown: ${formatCooldown(cooldownRemaining)}`
                        : mintPrice != null && supply != null
                          ? `Mint Verse #${supply + 1} (${formatEther(mintPrice as bigint)} ETH)`
                          : mintPrice != null
                            ? `Mint Next Verse (${formatEther(mintPrice as bigint)} ETH)`
                            : 'Loading...'}
                </button>
                <p className="text-xs text-gray-500">
                  Mints the next available verse sequentially
                </p>
                {isOnCooldown && (
                  <p className="text-sm text-amber-400">
                    You can mint again in {formatCooldown(cooldownRemaining)}
                  </p>
                )}
                {writeError && (
                  <div className="p-3 bg-red-900/30 border border-red-700 rounded text-sm">
                    {writeError.message.length > 120
                      ? writeError.message.slice(0, 120) + '...'
                      : writeError.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verse grid */}
          <h2 className="text-2xl font-bold mb-6">All 81 Verses</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-2">
            {verses.map((verse, idx) => {
              const result = ownerResults?.[idx]
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
                  className={`relative aspect-square rounded-lg border text-center flex flex-col items-center justify-center p-1 transition-all hover:scale-105 ${
                    isOwner
                      ? 'border-dao-gold bg-dao-gold/10'
                      : isMinted
                        ? 'border-slate-600 bg-slate-800/30 opacity-60'
                        : 'border-dao-purple/50 bg-dao-purple/10 hover:border-dao-purple'
                  }`}
                  title={`Verse #${verse.id}: ${verse.title}${isMinted ? (isOwner ? ' (yours)' : ' (minted)') : ' (available)'}`}
                >
                  <span className="text-xs font-bold text-gray-300">
                    #{verse.id}
                  </span>
                  {isOwner && (
                    <span className="text-[9px] text-dao-gold font-semibold mt-0.5">
                      YOURS
                    </span>
                  )}
                  {isMinted && !isOwner && (
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      MINTED
                    </span>
                  )}
                  {!isMinted && (
                    <span className="text-[9px] text-dao-purple mt-0.5">
                      OPEN
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* How it works */}
          <div className="bg-dao-purple/10 border border-dao-purple/30 rounded-lg p-6 mt-8">
            <h3 className="text-lg font-semibold mb-3 text-dao-purple">
              How Verse NFTs Work
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>
                1. Each of the 81 verses of the Dao DeGen is a unique NFT on
                Unichain
              </p>
              <p>
                2. Every $DAODEGEN swap generates a 1% fee captured by the
                TokenJar Hook and held in the DaoDeGenJar
              </p>
              <p>
                3. Fees accumulate until someone calls <code>release()</code>,
                which burns $DAODEGEN and distributes the Jar to all 81 NFTs
                (1/81 per NFT)
              </p>
              <p>
                4. The <code>mint()</code> function assigns the next available
                verse sequentially, with a bonding curve that increases price
                after each mint
              </p>
              <p>
                5. A 24-hour cooldown per wallet prevents any single address
                from accumulating too quickly
              </p>
              <p>
                6. After minting, visit the{' '}
                <Link href="/claim" className="text-dao-gold hover:underline">
                  Claim page
                </Link>{' '}
                to trigger a release and withdraw your share
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
