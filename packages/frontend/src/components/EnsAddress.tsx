'use client'

import { useEnsName } from '../hooks/useEnsName'
import { chainConfig } from '../lib/contracts'

interface EnsAddressProps {
  address: string
  className?: string
  linked?: boolean
}

/**
 * Displays an ENS name for an address, falling back to a truncated hex address.
 * By default renders as a link to the block explorer.
 */
export function EnsAddress({ address, className, linked = true }: EnsAddressProps) {
  const displayName = useEnsName(address)

  if (!linked) {
    return <span className={className}>{displayName}</span>
  }

  return (
    <a
      href={`${chainConfig.explorerUrl}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {displayName}
    </a>
  )
}
