'use client'

import Link from 'next/link'
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatUnits } from 'viem'
import { useState, useEffect, useCallback } from 'react'
import { Navigation } from '../../components/Navigation'
import { CONTRACT_ADDRESSES, chainConfig } from '../../lib/contracts'
import { CHAIN_CONFIG, fetchDirectQuote, buildSwapCalldata, type DirectQuote } from '../../lib/direct-swap'

const CHAIN_ID = chainConfig.chainId
const EXPLORER_URL = chainConfig.explorerUrl
const SLIPPAGE_OPTIONS = [0.1, 0.5, 1]

export default function SwapPage() {
  const { address, isConnected, chain } = useAccount()
  const { data: balance } = useBalance({ address })
  const isCorrectChain = chain?.id === CHAIN_ID

  // Swap form state
  const [ethAmount, setEthAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [customSlippage, setCustomSlippage] = useState('')
  const [showSlippage, setShowSlippage] = useState(false)

  // Quote state
  const [quote, setQuote] = useState<DirectQuote | null>(null)
  const [quoteFetchedAt, setQuoteFetchedAt] = useState<number | null>(null)
  const [quoteStale, setQuoteStale] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // General error (e.g. createSwap API failure before tx)
  const [swapApiError, setSwapApiError] = useState<string | null>(null)

  // Transaction state
  const { sendTransaction, data: swapHash, isPending: swapPending, error: swapError, reset: resetTx } = useSendTransaction()
  const { isLoading: swapConfirming, isSuccess: swapConfirmed } = useWaitForTransactionReceipt({ hash: swapHash })

  const parsedCustom = customSlippage ? parseFloat(customSlippage) : NaN
  const activeSlippage = !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : slippage

  // Debounced quote fetching — direct V4 path (routing API doesn't allowlist hook pools)
  useEffect(() => {
    const amount = parseFloat(ethAmount)
    if (!ethAmount || isNaN(amount) || amount <= 0 || !address || !isCorrectChain) {
      setQuote(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }

    setQuoteLoading(true)
    setQuoteError(null)

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const result = await fetchDirectQuote(
          CHAIN_ID,
          parseEther(ethAmount),
          Math.round(activeSlippage * 100),
        )
        if (!controller.signal.aborted) {
          setQuote(result)
          setQuoteFetchedAt(Date.now())
          setQuoteStale(false)
          setQuoteError(null)
          setQuoteLoading(false)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setQuote(null)
          setQuoteError(err instanceof Error ? err.message : 'Failed to fetch quote')
          setQuoteLoading(false)
        }
      }
    }, 500)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [ethAmount, address, isCorrectChain, activeSlippage])

  // Mark quote as stale after 30 seconds
  useEffect(() => {
    if (!quoteFetchedAt || !quote) {
      setQuoteStale(false)
      return
    }
    const elapsed = Date.now() - quoteFetchedAt
    const remaining = 30_000 - elapsed
    if (remaining <= 0) {
      setQuoteStale(true)
      return
    }
    const timer = setTimeout(() => setQuoteStale(true), remaining)
    return () => clearTimeout(timer)
  }, [quoteFetchedAt, quote])

  // Handle swap — direct V4 via UniversalRouter
  const handleSwap = useCallback(async () => {
    if (!quote) return
    setSwapApiError(null)

    try {
      const cfg = CHAIN_CONFIG[CHAIN_ID]
      if (!cfg) throw new Error(`No config for chain ${CHAIN_ID}`)

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 min
      const tx = buildSwapCalldata(cfg, quote.amountIn, quote.amountOutMin, deadline)
      sendTransaction({ to: tx.to, data: tx.data, value: tx.value })
    } catch (err) {
      setSwapApiError(err instanceof Error ? err.message : 'Swap failed')
    }
  }, [quote, sendTransaction])

  // Reset for a new swap
  const handleReset = useCallback(() => {
    setEthAmount('')
    setQuote(null)
    setQuoteFetchedAt(null)
    setQuoteStale(false)
    setQuoteError(null)
    setSwapApiError(null)
    resetTx()
  }, [resetTx])

  // Derived values
  const ethNum = parseFloat(ethAmount) || 0
  const insufficientBalance = balance && ethNum > parseFloat(balance.formatted)
  const outputAmount = quote ? formatUnits(quote.amountOut, 18) : null
  const canSwap = isConnected && isCorrectChain && quote && !quoteLoading && !quoteStale && !insufficientBalance && ethNum > 0 && !swapPending && !swapConfirming

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet'
    if (!isCorrectChain) return `Switch to ${chainConfig.chainName}`
    if (!ethAmount || ethNum <= 0) return 'Enter Amount'
    if (insufficientBalance) return 'Insufficient ETH Balance'
    if (quoteLoading) return 'Fetching Quote...'
    if (quoteStale) return 'Quote expired — refresh to continue'
    if (quoteError) return 'Quote Unavailable'
    if (swapPending) return 'Confirm in Wallet...'
    if (swapConfirming) return 'Confirming...'
    if (swapConfirmed) return 'Swap Successful'
    return 'Swap'
  }

  const DAODEGEN_TOKEN_ADDRESS = CONTRACT_ADDRESSES.DAODEGEN_TOKEN

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent">
            Buy $DAODEGEN
          </h1>
          <p className="text-lg text-gray-400">
            Swap fees fund verse NFT holders through the TokenJar Hook
          </p>
        </div>

        {/* Chain Warnings */}
        {!isConnected && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div>
                <h3 className="text-lg font-semibold text-amber-400">Wallet Not Connected</h3>
                <p className="text-amber-200 text-sm">Connect your wallet to start swapping $DAODEGEN</p>
              </div>
            </div>
          </div>
        )}

        {isConnected && !isCorrectChain && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div>
                <h3 className="text-lg font-semibold text-red-400">Wrong Network</h3>
                <p className="text-red-200 text-sm">Please switch to {chainConfig.chainName} (Chain ID: {CHAIN_ID}) to swap $DAODEGEN</p>
              </div>
            </div>
          </div>
        )}

        {/* Swap Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-8">

          {/* You Pay */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>You Pay</span>
              {isConnected && balance && (
                <button
                  onClick={() => setEthAmount(balance.formatted)}
                  className="hover:text-dao-gold transition-colors"
                >
                  Balance: {parseFloat(balance.formatted).toFixed(4)} ETH
                </button>
              )}
            </div>
            <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4 flex items-center">
              <input
                type="number"
                placeholder="0.0"
                value={ethAmount}
                onChange={(e) => {
                  setEthAmount(e.target.value)
                  if (swapConfirmed) resetTx()
                  setSwapApiError(null)
                }}
                min="0"
                step="0.001"
                className="flex-1 bg-transparent text-2xl text-white outline-none placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-lg font-semibold text-gray-300 ml-4">ETH</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center my-3">
            <div className="bg-slate-700 rounded-full p-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* You Receive */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>You Receive</span>
            </div>
            <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4 flex items-center">
              <div className="flex-1 text-2xl text-white">
                {quoteLoading ? (
                  <span className="text-gray-500 animate-pulse">...</span>
                ) : outputAmount ? (
                  parseFloat(outputAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })
                ) : (
                  <span className="text-gray-600">0.0</span>
                )}
              </div>
              <span className="text-lg font-semibold text-dao-gold ml-4">DDGEN</span>
            </div>
          </div>

          {/* Quote Details */}
          {quote && outputAmount && (
            <div className="bg-slate-900/30 rounded-lg p-4 mb-6 text-sm space-y-2">
              <div className="flex justify-between text-gray-400">
                <span>Rate</span>
                <span className="text-white">
                  1 ETH = {ethNum > 0
                    ? (parseFloat(outputAmount) / ethNum).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '---'} DDGEN
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Price Impact</span>
                <span className={quote.priceImpactPct > 5 ? 'text-red-400' : 'text-white'}>
                  ~{quote.priceImpactPct.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Hook Fee</span>
                <span className="text-white">1% (to VERSE holders)</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Slippage Tolerance</span>
                <span className="text-white">{activeSlippage}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Min. Received</span>
                <span className="text-white">
                  {parseFloat(formatUnits(quote.amountOutMin, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} DDGEN
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Route</span>
                <span className="text-white">V4 Direct (DaoDeGenHook)</span>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="mb-6">
            <button
              onClick={() => setShowSlippage(!showSlippage)}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center"
            >
              Slippage: {activeSlippage}%
              <svg className={`h-4 w-4 ml-1 transition-transform ${showSlippage ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSlippage && (
              <div className="mt-3 flex items-center space-x-2">
                {SLIPPAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSlippage(opt); setCustomSlippage('') }}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      activeSlippage === opt && !customSlippage
                        ? 'bg-dao-purple text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    {opt}%
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippage(e.target.value)}
                  min="0.01"
                  max="50"
                  step="0.1"
                  className="w-20 px-3 py-1.5 rounded bg-slate-700 text-white text-sm outline-none border border-slate-600 focus:border-dao-purple [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}
          </div>

          {/* Errors */}
          {quoteError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
              {quoteError}
            </div>
          )}

          {swapApiError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
              {swapApiError}
            </div>
          )}

          {swapError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
              {swapError.message.length > 120 ? swapError.message.slice(0, 120) + '...' : swapError.message}
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={canSwap ? handleSwap : undefined}
            disabled={!canSwap}
            className={`w-full font-semibold py-4 px-6 rounded-lg text-lg transition-colors ${
              canSwap
                ? 'bg-dao-gold hover:bg-amber-600 text-dao-dark'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {getButtonText()}
          </button>

          {/* Success */}
          {swapConfirmed && swapHash && (
            <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg text-center">
              <p className="text-green-300 font-semibold mb-2">Swap confirmed!</p>
              <a
                href={`${EXPLORER_URL}/tx/${swapHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dao-gold hover:underline text-sm"
              >
                View transaction on explorer
              </a>
              <div className="mt-3">
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Start a new swap
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Token Info */}
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">$DAODEGEN Token Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Chain:</span>
                <span className="text-white">{chainConfig.chainName} (ID: {CHAIN_ID})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Contract:</span>
                <span className="text-dao-gold font-mono text-xs">
                  {DAODEGEN_TOKEN_ADDRESS}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Standard:</span>
                <span className="text-white">ERC-20</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Supply:</span>
                <span className="text-white">81,000,000 DAODEGEN</span>
              </div>
            </div>
          </div>

          <div className="bg-dao-purple/10 border border-dao-purple/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-dao-purple">Revenue Sharing Mechanism</h3>
            <p className="text-sm text-gray-300 mb-4">
              Every $DAODEGEN swap generates fees captured by the TokenJar Hook and held in the Jar.
              Distribution to NFT holders requires calling <code>release()</code>, which burns $DAODEGEN.
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <div>&#8226; Swap fees accumulate in the TokenJar</div>
              <div>&#8226; Anyone calls release() to distribute (burns $DAODEGEN)</div>
              <div>&#8226; Distributed equally: 1/81 per verse NFT</div>
              <div>&#8226; Claim your share on the Claim page</div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Link
                href="/verses"
                className="bg-dao-purple/20 hover:bg-dao-purple/30 border border-dao-purple/50 rounded-lg p-3 text-center transition-colors"
              >
                View Verses
              </Link>
              <Link
                href="/claim"
                className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg p-3 text-center transition-colors"
              >
                Claim NFTs
              </Link>
            </div>
          </div>
        </div>
        </div>
      </div>
    </main>
  )
}
