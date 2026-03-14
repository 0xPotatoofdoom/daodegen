// Centralised chain configuration — driven by NEXT_PUBLIC_ACTIVE_CHAIN.
// Defaults to "sepolia" so nothing breaks for dev.

type ChainPreset = 'sepolia' | 'mainnet'

interface ChainConfig {
  chainId: number
  chainName: string
  rpcUrl: string
  explorerUrl: string
  isTestnet: boolean
}

const PRESETS: Record<ChainPreset, ChainConfig> = {
  sepolia: {
    chainId: 1301,
    chainName: 'Unichain Sepolia',
    rpcUrl: 'https://sepolia.unichain.org',
    explorerUrl: 'https://sepolia.unichains.org',
    isTestnet: true,
  },
  mainnet: {
    chainId: 130,
    chainName: 'Unichain',
    rpcUrl: 'https://mainnet.unichain.org',
    explorerUrl: 'https://unichains.org',
    isTestnet: false,
  },
}

function resolvePreset(): ChainPreset {
  const raw = process.env.NEXT_PUBLIC_ACTIVE_CHAIN ?? 'sepolia'
  if (raw === 'mainnet' || raw === 'sepolia') return raw
  console.warn(`Unknown NEXT_PUBLIC_ACTIVE_CHAIN="${raw}", falling back to "sepolia"`)
  return 'sepolia'
}

const preset = resolvePreset()
const base = PRESETS[preset]

/** The active chain configuration for the entire frontend. */
export const chainConfig: ChainConfig = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID
    ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
    : base.chainId,
  chainName: base.chainName,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? base.rpcUrl,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? base.explorerUrl,
  isTestnet: base.isTestnet,
}
