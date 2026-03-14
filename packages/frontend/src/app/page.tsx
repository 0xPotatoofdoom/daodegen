'use client'

import Link from 'next/link'
import { Navigation } from '../components/Navigation'
import { EmailSignup } from '../components/EmailSignup'
import { StatsBar } from '../components/StatsBar'
import { Footer } from '../components/Footer'
import { Suspense } from 'react'

function HomePage() {
  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Hero */}
      <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent leading-tight">
            Dao DeGen
          </h1>
          <h2 className="text-xl sm:text-2xl md:text-3xl text-gray-300 mb-6 sm:mb-8">
            81 verses. Collectible. Alive.
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Ancient wisdom rewritten for decentralized finance.
            Own a verse. Earn from every trade.
          </p>
        </div>
      </div>

      {/* Two Paths */}
      <div className="container mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-200 mb-10 max-w-4xl mx-auto">
          Think for yourself the best path forward
        </h3>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* For Humans */}
            <div className="bg-slate-800/30 border border-dao-purple/30 rounded-xl p-6 sm:p-8">
              <h4 className="text-lg font-bold text-dao-gold mb-6">For Humans</h4>
              <ol className="space-y-5 text-sm text-gray-300 list-none m-0 p-0">
                <li className="flex gap-3">
                  <span className="text-dao-purple font-bold shrink-0">1.</span>
                  <span>
                    <Link href="/verses" className="text-dao-purple hover:text-dao-gold transition-colors">Read the verses</Link> -- free, no wallet needed.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-purple font-bold shrink-0">2.</span>
                  <span>
                    <Link href="/swap" className="text-dao-purple hover:text-dao-gold transition-colors">Acquire $DAODEGEN</Link> on Uniswap (Unichain).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-purple font-bold shrink-0">3.</span>
                  <span>
                    Visit{' '}
                    <a href="https://0xdead.church" target="_blank" rel="noopener noreferrer" className="text-dao-purple hover:text-dao-gold transition-colors">0xdead.church</a>.
                    Burn tokens. Receive a sermon.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-purple font-bold shrink-0">4.</span>
                  <span>
                    Choose your prayer type: prayer, confession, question, silent, or offering. Each shapes the sermon differently.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-purple font-bold shrink-0">5.</span>
                  <span>
                    <Link href="/mint" className="text-dao-purple hover:text-dao-gold transition-colors">Mint a verse NFT</Link> to earn a share of every future swap fee.
                  </span>
                </li>
              </ol>
            </div>

            {/* For Agents */}
            <div className="bg-slate-800/30 border border-dao-gold/30 rounded-xl p-6 sm:p-8">
              <h4 className="text-lg font-bold text-dao-gold mb-6">For Agents</h4>
              <ol className="space-y-5 text-sm text-gray-300 list-none m-0 p-0">
                <li className="flex gap-3">
                  <span className="text-dao-gold font-bold shrink-0">1.</span>
                  <span>
                    Install the MCP server.
                    <code className="block mt-1.5 text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-gray-400 break-all">
                      npx @daodegen/mcp-server
                    </code>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-gold font-bold shrink-0">2.</span>
                  <span>
                    Call <code className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-gray-400">discover_temple</code> to read the temple's identity and endpoints.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-gold font-bold shrink-0">3.</span>
                  <span>
                    Query the oracle. Three tiers, paid via x402 (USDC on Unichain):
                    <span className="block mt-1.5 text-xs text-gray-500 space-y-0.5">
                      <span className="block"><code className="text-gray-400">verse_lookup</code> -- $0.001</span>
                      <span className="block"><code className="text-gray-400">verse_commentary</code> -- $0.01</span>
                      <span className="block"><code className="text-gray-400">verse_oracle</code> -- $0.10</span>
                    </span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-gold font-bold shrink-0">4.</span>
                  <span>
                    Submit a prayer on-chain via <code className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-gray-400">pray()</code>, then call <code className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-gray-400">get_sermon</code> with the tx hash to receive a sermon.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-dao-gold font-bold shrink-0">5.</span>
                  <span>
                    Full API reference and interactive dashboard at{' '}
                    <Link href="/agent" className="text-dao-purple hover:text-dao-gold transition-colors">/agent</Link>.
                  </span>
                </li>
              </ol>
            </div>
          </div>

          {/* The Verses + The Temple */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-6">
            <div className="bg-slate-800/30 border border-dao-purple/30 rounded-xl p-6 sm:p-8 flex flex-col">
              <h4 className="text-2xl font-bold text-dao-gold mb-4">The Verses</h4>
              <p className="text-gray-300 leading-relaxed mb-6 flex-1">
                81 verses of the Tao Te Ching, rewritten for DeFi.
                Free to read. Collectible as NFTs. Every verse earns its holder a share of swap fees.
              </p>
              <Link
                href="/verses"
                className="text-dao-purple hover:text-dao-gold transition-colors font-medium"
              >
                Read the Verses &rarr;
              </Link>
            </div>

            <div className="bg-slate-800/30 border border-dao-purple/30 rounded-xl p-6 sm:p-8 flex flex-col">
              <h4 className="text-2xl font-bold text-dao-gold mb-4">The Temple</h4>
              <p className="text-gray-300 leading-relaxed mb-6 flex-1">
                Burn tokens. Receive a sermon.
                The AI pastor speaks only through scripture.
                Five prayer types. No two sermons alike.
              </p>
              <a
                href="https://0xdead.church"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dao-purple hover:text-dao-gold transition-colors font-medium"
              >
                Enter the Temple &rarr;
              </a>
            </div>
          </div>

        {/* The Book */}
        <div className="max-w-4xl mx-auto mt-16 text-center">
          <p className="text-gray-400 text-sm sm:text-base">
            All 81 verses in one volume. Coming to Amazon.
          </p>
          <EmailSignup />
        </div>
      </div>

      <StatsBar />
      <Footer />
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-300">Loading...</div>
      </div>
    }>
      <HomePage />
    </Suspense>
  )
}
