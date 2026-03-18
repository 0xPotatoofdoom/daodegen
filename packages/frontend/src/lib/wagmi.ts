import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';


// RPC URLs use public endpoints as fallbacks -- these are not secrets.
const unichainRpc = process.env.NEXT_PUBLIC_UNICHAIN_RPC || 'https://mainnet.unichain.org';
const unichainSepoliaRpc = process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC || 'https://sepolia.unichain.org';

// Custom Unichain configuration (chain ID 130)
const unichain = {
  id: 130,
  name: 'Unichain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [unichainRpc]
    }
  },
  blockExplorers: {
    default: { name: 'UnichainScan', url: 'https://unichains.org' },
  },
  testnet: false,
} as const;

// Unichain Sepolia (chain ID 1301)
const unichainSepolia = {
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [unichainSepoliaRpc]
    }
  },
  blockExplorers: {
    default: { name: 'UnichainScan', url: 'https://sepolia.unichains.org' },
  },
  testnet: true,
} as const;

export const config = getDefaultConfig({
  appName: 'Dao DeGen',
  projectId: (() => {
    const id = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
    if (!id || id === 'demo-project-id') {
      console.warn('[wagmi] NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set — wallet connections may fail in production');
    }
    return id || 'demo-project-id';
  })(),
  chains: [unichain, unichainSepolia],
  transports: {
    [unichain.id]: http(unichainRpc),
    [unichainSepolia.id]: http(unichainSepoliaRpc),
  },
  ssr: true, // For Next.js
  pollingInterval: 3_000,
});