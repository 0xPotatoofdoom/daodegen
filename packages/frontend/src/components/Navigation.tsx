'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState } from 'react';
import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import styles from './Navigation.module.css'

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className={`${styles.nav} container mx-auto px-4 py-6 flex justify-between items-center`}>
      <Link href="/" className={`${styles.link} text-2xl font-bold bg-gradient-to-r from-dao-purple to-dao-gold bg-clip-text text-transparent`}>
        Dao DeGen
      </Link>

      <div className={`${styles.desktop} flex items-center space-x-6`}>
        <Link href="/verses" className="text-white hover:text-dao-gold transition-colors">
          Verses
        </Link>
        <Link href="/mint" className="text-white hover:text-dao-gold transition-colors">
          Mint
        </Link>
        <Link href="/swap" className="text-white hover:text-dao-gold transition-colors">
          Swap
        </Link>
        <Link href="/claim" className="text-white hover:text-dao-gold transition-colors">
          Claim
        </Link>
        <Link href="/agent" className="text-white hover:text-dao-gold transition-colors">
          Agent
        </Link>
        <a href="https://0xdead.church" target="_blank" rel="noopener noreferrer" className="text-white hover:text-dao-gold transition-colors">
          Temple
        </a>
        {process.env.NEXT_PUBLIC_APP_ENV !== 'production' && (
          <Link href="/ops" className="text-white hover:text-dao-gold transition-colors">
            Ops
          </Link>
        )}
        <ConnectButton />
      </div>

      <div className={`${styles.mobile} relative flex items-center`}>
        <button onClick={() => setIsOpen(!isOpen)} className="text-white hover:text-dao-gold focus:outline-none">
          {isOpen ? (
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
        {isOpen && (
          <div className="absolute top-full right-0 mt-2 bg-slate-800 rounded-md shadow-lg border border-dao-purple/30 overflow-hidden z-10">
            <div className="py-1">
              <Link href="/verses" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Verses</Link>
              <Link href="/mint" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Mint</Link>
              <Link href="/swap" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Swap</Link>
              <Link href="/claim" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Claim</Link>
              <Link href="/agent" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Agent</Link>
              <a href="https://0xdead.church" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Temple</a>
              {process.env.NEXT_PUBLIC_APP_ENV !== 'production' && (
                <Link href="/ops" className="block px-4 py-2 text-sm text-gray-300 hover:bg-dao-purple hover:text-white transition-colors">Ops</Link>
              )}
            </div>
            <div className="px-4 py-2">
              <ConnectButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}