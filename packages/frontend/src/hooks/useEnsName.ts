'use client'

import { useEnsName as useWagmiEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { Address } from 'viem'

/**
 * Resolve an Ethereum address to its ENS name (via mainnet).
 * Returns the ENS name if found, otherwise a shortened address like "0x0026...C108".
 */
export function useEnsName(address: string | undefined) {
  const { data: ensName } = useWagmiEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    query: { enabled: !!address },
  })

  if (!address) return null

  if (ensName) return ensName

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
