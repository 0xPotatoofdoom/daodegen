import { NextResponse } from 'next/server'
import { CONTRACT_ADDRESSES, chainConfig } from '../../../lib/contracts'

export async function GET() {
  return NextResponse.json({
    schema: 'ERC-8004',
    version: '1.0',
    network: {
      chainId: chainConfig.chainId,
      name: chainConfig.chainName,
    },
    contracts: {
      agentRegistry: CONTRACT_ADDRESSES.AGENT_REGISTRY,
      verseNFT: CONTRACT_ADDRESSES.VERSE_NFT,
      daoDeGenToken: CONTRACT_ADDRESSES.DAODEGEN_TOKEN,
      daoDeGenJar: CONTRACT_ADDRESSES.DAODEGEN_JAR,
      prayerBurn: CONTRACT_ADDRESSES.PRAYER_BURN,
    },
    selfProtocol: {
      agentId: 25,
      agentAddress: '0x7d7AC1aAaBCEeb12149615A05C17FE74b8730c46',
      chain: 'celo',
      chainId: 42220,
      verificationStrength: 'passport',
      verify: 'https://app.ai.self.xyz/api/agent/verify/42220/25',
    },
    capabilities: ['register', 'update', 'revoke'],
    authentication: {
      method: 'SIWE',
      nonceEndpoint: '/api/auth/nonce',
      verifyEndpoint: '/api/auth/verify',
    },
    api: {
      verseOracle: {
        description: 'AI-powered verse oracle with x402 payment. Returns verse interpretations from the 81 sacred verses.',
        endpoints: {
          singleVerse: '/v1/verse',
          verseList: '/v1/verse/list',
          metadata: '/api/verse/{id}/metadata',
        },
        payment: {
          protocol: 'x402',
          asset: 'USDC',
          chain: chainConfig.chainName,
          facilitator: process.env.FACILITATOR_URL || null,
          flow: [
            'POST protected endpoint -> receive HTTP 402 with X-Payment-Required header',
            'Send USDC via x402 facilitator -> receive payment token',
            'Retry request with X-Payment-Token header',
          ],
        },
      },
      verses: {
        description: 'Public verse data. 81 verses with title, body, alpha, and illustration.',
        count: 81,
        metadataPattern: '/api/verse/{id}/metadata',
      },
    },
  })
}
