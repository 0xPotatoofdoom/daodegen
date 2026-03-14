import { SiweMessage, generateNonce } from 'siwe';
import { createPublicClient, http, defineChain } from 'viem';
import { unichain, unichainSepolia } from 'viem/chains';
import { CONTRACT_ADDRESSES, AGENT_REGISTRY_ABI } from './contracts';
import { createNonceStore } from './stores';

const activeNonces = createNonceStore();

setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of activeNonces.entries()) {
    if (expiry < now) activeNonces.delete(nonce);
  }
}, 60_000);

const MAX_NONCES = 10_000;

// SIWE domain and chain allowlists
const ALLOWED_DOMAINS = new Set(
  (process.env.SIWE_ALLOWED_DOMAINS || 'localhost,daodegen.com').split(',').map(d => d.trim())
);
const ALLOWED_CHAIN_IDS = new Set(
  (process.env.SIWE_ALLOWED_CHAIN_IDS || '1301,130').split(',').map(id => Number(id.trim()))
); // 1301 = Unichain Sepolia, 130 = Unichain mainnet

export function getNonce() {
  if (activeNonces.size() >= MAX_NONCES) {
    // Evict oldest entries
    const entries = [...activeNonces.entries()];
    entries.sort((a, b) => a[1] - b[1]);
    const toDelete = entries.slice(0, Math.floor(MAX_NONCES / 4));
    for (const [nonce] of toDelete) {
      activeNonces.delete(nonce);
    }
  }
  const nonce = generateNonce();
  activeNonces.set(nonce, Date.now() + 5 * 60 * 1000);
  return nonce;
}

// Use env RPC to detect chain — Sepolia if RPC contains "sepolia"
const RPC_URL = process.env.NEXT_PUBLIC_UNICHAIN_RPC || 'https://sepolia.unichain.org';
const IS_SEPOLIA = RPC_URL.includes('sepolia');

const client = createPublicClient({
  chain: IS_SEPOLIA ? unichainSepolia : unichain,
  transport: http(RPC_URL),
});

export interface VerifySessionParams {
  message: string;
  signature: string;
}

export interface AuthResult {
  success: boolean;
  address?: string;
  agentId?: string;
  error?: string;
}

export async function verifyAgentIdentity(params: VerifySessionParams): Promise<AuthResult> {
  try {
    const siweMessage = new SiweMessage(params.message);
    
    // Validate Nonce
    const expiry = activeNonces.get(siweMessage.nonce);
    if (!expiry || expiry < Date.now()) {
        return { success: false, error: 'Invalid or expired nonce' };
    }
    activeNonces.delete(siweMessage.nonce); // Burn nonce after use

    // Validate domain
    const domain = siweMessage.domain?.replace(/:\d+$/, ''); // strip port
    if (!domain || !ALLOWED_DOMAINS.has(domain)) {
      return { success: false, error: `Domain not allowed: ${siweMessage.domain}` };
    }

    // Validate chain ID
    if (siweMessage.chainId && !ALLOWED_CHAIN_IDS.has(siweMessage.chainId)) {
      return { success: false, error: `Chain ID not allowed: ${siweMessage.chainId}` };
    }

    let verifyResult;
    try {
        verifyResult = await siweMessage.verify({ 
            signature: params.signature,
            nonce: siweMessage.nonce 
        });
    } catch {
        return { success: false, error: 'Invalid signature' };
    }
    
    if (!verifyResult.success) {
      return { success: false, error: 'Invalid signature' };
    }

    const address = siweMessage.address;

    if (!CONTRACT_ADDRESSES.AGENT_REGISTRY || CONTRACT_ADDRESSES.AGENT_REGISTRY === '0x0000000000000000000000000000000000000000') {
        if (process.env.NODE_ENV === 'production') {
            console.error('[auth] AGENT_REGISTRY is zero-address in production — rejecting auth');
            return { success: false, error: 'AGENT_REGISTRY not configured' };
        }
        // Dev/test only: allow bypass with a synthetic agent ID
        return { success: true, address, agentId: 'dev-agent-1' };
    }

    let isAgent = false;
    let agentId = '0';

    try {
        const result = await client.readContract({
            address: CONTRACT_ADDRESSES.AGENT_REGISTRY as `0x${string}`,
            abi: AGENT_REGISTRY_ABI,
            functionName: 'isAgent',
            args: [address as `0x${string}`],
        });
        isAgent = result as boolean;

        if (isAgent) {
            const id = await client.readContract({
                address: CONTRACT_ADDRESSES.AGENT_REGISTRY as `0x${string}`,
                abi: AGENT_REGISTRY_ABI,
                functionName: 'getAgentId',
                args: [address as `0x${string}`],
            });
            agentId = (id as bigint).toString();
        }
    } catch (e) {
        console.warn('Contract read failed:', e);
    }

    // Non-agent wallets get a "user" role — they can still burn and pray
    // but agent-specific endpoints can check for a real agentId
    return { success: true, address, agentId: isAgent ? agentId : 'user' };

  } catch (error: unknown) {
    console.error('verifyAgentIdentity error:', error);
    return { success: false, error: 'Verification failed' };
  }
}