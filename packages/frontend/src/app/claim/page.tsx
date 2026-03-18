'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther, Address, zeroAddress } from 'viem'
import { useState, useEffect } from 'react'
import { Navigation } from '../../components/Navigation'
import { CONTRACT_ADDRESSES, VERSE_NFT_ABI, DAODEGEN_TOKEN_ABI, DAODEGEN_JAR_ABI } from '../../lib/contracts'

export default function ClaimPage() {
  const { address, isConnected } = useAccount()
  const [claimingTokenId, setClaimingTokenId] = useState<bigint | null>(null)

  // --- Release flow (approve + release) ---
  const { writeContract: writeRelease, data: releaseHash, isPending: releasePending, error: releaseError } = useWriteContract()
  const { isLoading: releaseConfirming, isSuccess: releaseConfirmed } = useWaitForTransactionReceipt({ hash: releaseHash })

  // --- Claim flow (individual token withdraw) ---
  const { writeContract: writeClaim, data: claimHash, isPending: claimPending, error: claimError } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash })

  // Read user's NFT balance
  const { data: nftBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
    abi: VERSE_NFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // Read burn amount required for release
  const { data: burnAmount } = useReadContract({
    address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
    abi: DAODEGEN_JAR_ABI,
    functionName: 'burnAmount',
  })

  // Read user's DAODEGEN balance
  const { data: tokenBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.DAODEGEN_TOKEN as Address,
    abi: DAODEGEN_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // Read user's allowance for the jar contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.DAODEGEN_TOKEN as Address,
    abi: DAODEGEN_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.DAODEGEN_JAR] : undefined,
    query: { enabled: !!address }
  })

  // Read outstanding ETH in jar (allocated to holders but unclaimed)
  const { data: outstandingETH, refetch: refetchOutstanding } = useReadContract({
    address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
    abi: DAODEGEN_JAR_ABI,
    functionName: 'outstanding',
    args: [zeroAddress],
  })

  // Read jar contract ETH balance (total held: undistributed + unclaimed)
  const { data: jarBalance, refetch: refetchJarBalance } = useBalance({
    address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
  })

  // Read user's owned token IDs
  const nftCount = nftBalance != null ? Number(nftBalance as bigint) : 0
  const { data: tokenIdResults } = useReadContracts({
    contracts: Array.from({ length: nftCount }, (_, i) => ({
      address: CONTRACT_ADDRESSES.VERSE_NFT as Address,
      abi: VERSE_NFT_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address!, BigInt(i)],
    })),
    query: { enabled: !!address && nftCount > 0 }
  })

  const ownedTokenIds: bigint[] = (tokenIdResults
    ?.filter((r: { status: string }) => r.status === 'success')
    .map((r: { result: unknown }) => r.result as bigint) || [])
    .sort((a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0))

  // Read claimable ETH for each owned token
  const { data: claimableResults, refetch: refetchClaimable } = useReadContracts({
    contracts: ownedTokenIds.map(tokenId => ({
      address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
      abi: DAODEGEN_JAR_ABI,
      functionName: 'claimable',
      args: [tokenId, zeroAddress],
    })),
    query: { enabled: ownedTokenIds.length > 0 }
  })

  // Refetch balances after successful release or claim
  useEffect(() => {
    if (releaseConfirmed || claimConfirmed) {
      refetchOutstanding()
      refetchClaimable()
      refetchAllowance()
      refetchJarBalance()
    }
  }, [releaseConfirmed, claimConfirmed, refetchOutstanding, refetchClaimable, refetchAllowance, refetchJarBalance])

  const needsApproval = allowance != null && burnAmount != null && (allowance as bigint) < (burnAmount as bigint)
  const canRelease = isConnected && !needsApproval && burnAmount != null && tokenBalance != null && (tokenBalance as bigint) >= (burnAmount as bigint)

  const handleApprove = () => {
    if (!burnAmount) return
    writeRelease({
      address: CONTRACT_ADDRESSES.DAODEGEN_TOKEN as Address,
      abi: DAODEGEN_TOKEN_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.DAODEGEN_JAR as Address, burnAmount as bigint],
    })
  }

  const handleRelease = () => {
    writeRelease({
      address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
      abi: DAODEGEN_JAR_ABI,
      functionName: 'release',
      args: [[zeroAddress]],
    })
  }

  const handleClaimToken = (tokenId: bigint) => {
    setClaimingTokenId(tokenId)
    writeClaim({
      address: CONTRACT_ADDRESSES.DAODEGEN_JAR as Address,
      abi: DAODEGEN_JAR_ABI,
      functionName: 'claim',
      args: [tokenId, [zeroAddress]],
    })
  }

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent">
              Claim Your Fees
            </h1>
            <p className="text-lg text-gray-400">
              NFT holders can claim their share of accumulated swap fees
            </p>
          </div>

          {/* Wallet Connection */}
          <div className="mb-8">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
              <h3 className="text-xl font-semibold mb-4">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-6">
                Connect your wallet to view and claim fees for your verse NFTs
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>

          {isConnected && (
            <>
              {/* Fee Overview */}
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Jar Fee Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Undistributed:</span>
                      <span className="text-dao-gold font-semibold">
                        {jarBalance != null && outstandingETH != null
                          ? `${formatEther(jarBalance.value - (outstandingETH as bigint))} ETH`
                          : 'Loading...'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Allocated (Unclaimed):</span>
                      <span className="text-dao-gold font-semibold">
                        {outstandingETH != null ? `${formatEther(outstandingETH as bigint)} ETH` : 'Loading...'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Undistributed fees must be released before holders can claim. Allocated fees are already assigned to NFT holders awaiting claim.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Your Verse NFTs</h3>
                  <div className="text-center py-4">
                    {nftBalance != null ? (
                      <>
                        <p className="text-dao-gold font-semibold text-xl">
                          {nftBalance.toString()} NFT{Number(nftBalance) !== 1 ? 's' : ''}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                          Each NFT earns 1/81 of all fees
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm">Loading your verses...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Claim Individual Tokens */}
              {ownedTokenIds.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold mb-4">Claim Your Fees</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Withdraw your accumulated fees for each verse NFT you own.
                  </p>
                  <div className="space-y-3">
                    {ownedTokenIds.map((tokenId, index) => {
                      const claimable = claimableResults?.[index]
                      const amount = claimable?.status === 'success' ? (claimable.result as bigint) : 0n
                      const hasClaimable = amount > 0n
                      const isThisClaiming = claimingTokenId === tokenId && (claimPending || claimConfirming)

                      return (
                        <div key={tokenId.toString()} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-4">
                          <div>
                            <span className="text-white font-medium">Verse #{tokenId.toString()}</span>
                            <span className="text-gray-400 text-sm ml-3">
                              {claimable ? `${formatEther(amount)} ETH` : 'Loading...'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleClaimToken(tokenId)}
                            disabled={!hasClaimable || claimPending || claimConfirming}
                            className={`font-semibold py-2 px-4 rounded-lg text-sm transition-colors ${
                              hasClaimable && !claimPending && !claimConfirming
                                ? 'bg-dao-gold hover:bg-amber-600 text-dao-dark'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {isThisClaiming ? 'Claiming...' : 'Claim'}
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {claimConfirmed && (
                    <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded text-sm text-center">
                      Fees claimed successfully for Verse #{claimingTokenId?.toString()}!
                    </div>
                  )}

                  {claimError && (
                    <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-center">
                      {claimError.message.length > 100 ? claimError.message.slice(0, 100) + '...' : claimError.message}
                    </div>
                  )}
                </div>
              )}

              {/* Release Fees Section */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold mb-4">Release Fees to All NFT Holders</h3>

                <div className="text-center py-6">
                  <h4 className="text-xl font-semibold mb-2">Trigger Fee Distribution</h4>
                  <p className="text-gray-400 mb-6">
                    Anyone can trigger fee release by burning {burnAmount != null ? formatEther(burnAmount as bigint) : '---'} $DAODEGEN tokens.
                    <br />This distributes all accumulated fees to <em>all</em> NFT holders proportionally.
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-300">
                      Your $DAODEGEN balance: {tokenBalance != null ? formatEther(tokenBalance as bigint) : '---'} DDGEN
                    </p>

                    {needsApproval ? (
                      <button
                        onClick={handleApprove}
                        disabled={releasePending || releaseConfirming}
                        className="bg-dao-purple hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {releasePending || releaseConfirming ? 'Approving...' : 'Approve $DAODEGEN'}
                      </button>
                    ) : (
                      <button
                        onClick={handleRelease}
                        disabled={!canRelease || releasePending || releaseConfirming}
                        className={`font-semibold py-3 px-6 rounded-lg transition-colors ${
                          canRelease
                            ? 'bg-dao-gold hover:bg-yellow-500 text-dao-dark'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {releasePending || releaseConfirming ? 'Releasing Fees...' : 'Release Fees for All'}
                      </button>
                    )}
                  </div>

                  {!nftBalance || nftBalance === 0n ? (
                    <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm">
                      You don't own any Verse NFTs. Only NFT holders benefit from fee releases.
                    </div>
                  ) : null}

                  {releaseConfirmed && (
                    <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded text-sm">
                      Fees released successfully! All NFT holders can now claim their share.
                    </div>
                  )}

                  {releaseError && (
                    <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm">
                      {releaseError.message.length > 100 ? releaseError.message.slice(0, 100) + '...' : releaseError.message}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* How It Works */}
          <div className="bg-dao-purple/10 border border-dao-purple/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3 text-dao-purple">How Fee Claims Work</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1. Every $DAODEGEN swap generates fees captured by the TokenJar Hook and held in the Jar</p>
              <p>2. Anyone can trigger fee release by burning $DAODEGEN tokens</p>
              <p>3. Released fees are allocated proportionally to all 81 verse NFTs (1/81 per NFT)</p>
              <p>4. Individual NFT holders claim their allocated share using the Claim button above</p>
              <p>5. The burn cost rate-limits releases and creates deflationary pressure on $DAODEGEN</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
