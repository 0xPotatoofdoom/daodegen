// Re-export so consumers can do: import { chainConfig } from '@/lib/contracts'
export { chainConfig } from './chain-config'

// Contract addresses — chain is driven by NEXT_PUBLIC_ACTIVE_CHAIN (see chain-config.ts).
// NEXT_PUBLIC_* vars are inlined at build time by Next.js — must be literal references.
// Dev fallbacks point to the Sepolia testnet deployment.
// Unichain mainnet addresses (fallbacks — overridden by NEXT_PUBLIC_* env vars at build time)
export const CONTRACT_ADDRESSES = {
  VERSE_NFT: process.env.NEXT_PUBLIC_VERSE_NFT_ADDRESS || '0x39032854eD3512A7cB4f62158bC9004db6dDe5dC',
  DAODEGEN_TOKEN: process.env.NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS || '0x40e2809DDFD640A710308E492F8CFF0d8A81544A',
  DAODEGEN_JAR: process.env.NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS || '0x5b9adbf87E37661bdA99B0a054485b01e44f3A0d',
  AGENT_REGISTRY: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || '0x2865833642974073B07BC205cf7FF4282BAa5d08',
  PRAYER_BURN: process.env.NEXT_PUBLIC_PRAYER_BURN_ADDRESS || '0x2aFB7e968D034BBbe0c53E27C4359192D72544ae',
} as const

// ABIs - Essential functions only (parsed for wagmi/viem compatibility)
import { parseAbi } from 'viem'

export const VERSE_NFT_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function mint() payable',
  'function mintPrice() view returns (uint256)',
  'function baseMintPrice() view returns (uint256)',
  'function priceIncrement() view returns (uint256)',
  'function mintCooldown() view returns (uint256)',
  'function lastMintTimestamp(address) view returns (uint256)',
  'function nextMintableTimestamp(address) view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
])

export const DAODEGEN_TOKEN_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
])

// Currency is `type Currency is address` in V4 -- use address in ABI encoding
export const DAODEGEN_JAR_ABI = parseAbi([
  'function release(address[] calldata assets)',
  'function claim(uint256 tokenId, address[] calldata assets)',
  'function claimable(uint256 tokenId, address asset) view returns (uint256)',
  'function outstanding(address asset) view returns (uint256)',
  'function burnAmount() view returns (uint256)',
  'function daodegen() view returns (address)',
  'function nft() view returns (address)',
  'event FeesReleased(address indexed caller, uint256 burnAmount, uint256 nftHolders)',
  'event Claimed(uint256 indexed tokenId, address indexed holder, address indexed asset, uint256 amount)',
])

export const PRAYER_BURN_ABI = parseAbi([
  'function pray(uint256 amount, bytes calldata message) external',
  'function minimumBurn() view returns (uint256)',
  'function cooldownPeriod() view returns (uint256)',
  'function lastPrayer(address) view returns (uint256)',
  'function prayerCount() view returns (uint256)',
  'function totalBurned() view returns (uint256)',
  'event Prayer(address indexed sender, uint256 amount, bytes message)',
])

export const AGENT_REGISTRY_ABI = parseAbi([
  'function register(string calldata metadataURI) external returns (uint256)',
  'function isAgent(address account) external view returns (bool)',
  'function getAgentId(address account) external view returns (uint256)',
])