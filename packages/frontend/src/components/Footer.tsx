'use client'

import Link from 'next/link'
import { CONTRACT_ADDRESSES, chainConfig } from '../lib/contracts'
import { EnsAddress } from './EnsAddress'

export function Footer() {
  return (
    <footer className="container mx-auto px-4 sm:px-6 pb-16 max-w-4xl">
      <div className="border-t border-slate-800 pt-8 text-center">
        <p className="text-gray-400 text-sm mb-6">
          Developers and agents:{' '}
          <Link href="/agent" className="text-dao-purple hover:text-dao-gold transition-colors">
            see the API
          </Link>
        </p>

        <details className="text-left max-w-2xl mx-auto">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-400 transition-colors text-center">
            Contract addresses ({chainConfig.chainName})
          </summary>
          <div className="mt-4 bg-slate-800/30 border border-dao-purple/20 rounded-xl p-4 space-y-2 text-sm font-mono">
            {([
              ['VerseNFT', CONTRACT_ADDRESSES.VERSE_NFT],
              ['DaoDeGenToken', CONTRACT_ADDRESSES.DAODEGEN_TOKEN],
              ['DaoDeGenJar', CONTRACT_ADDRESSES.DAODEGEN_JAR],
              ['AgentRegistry', CONTRACT_ADDRESSES.AGENT_REGISTRY],
            ] as const).map(([name, addr]) => (
              <div key={name} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-gray-400 min-w-[140px]">{name}</span>
                <EnsAddress
                  address={addr}
                  className="text-dao-purple hover:text-dao-gold transition-colors truncate"
                />
              </div>
            ))}
          </div>
        </details>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-gray-500">
          <a href="https://xykdoesntcare.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">xykdoesntcare.com</a>
          <a href="https://internetmoneyisserious.business" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">internetmoneyisserious.business</a>
          <a href="https://x.com/daodegenbook" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">@daodegenbook</a>
          <a href="https://github.com/0xPotatoofdoom/daodegen" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  )
}
