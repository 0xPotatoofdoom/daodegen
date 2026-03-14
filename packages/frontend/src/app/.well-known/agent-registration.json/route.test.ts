import { describe, it, expect } from 'vitest';

import { GET } from './route';

describe('GET /.well-known/agent-registration.json', () => {
  it('returns 200 with valid response', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeTruthy();
  });

  it('returns ERC-8004 schema identifier', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.schema).toBe('ERC-8004');
  });

  it('returns version 1.0', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('1.0');
  });

  it('network chainId is 130 (Unichain)', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.network.chainId).toBe(130);
    expect(data.network.name).toBe('Unichain');
  });

  it('contracts object contains expected contract addresses', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.contracts).toHaveProperty('agentRegistry');
    expect(data.contracts).toHaveProperty('verseNFT');
    expect(data.contracts).toHaveProperty('daoDeGenToken');
    expect(data.contracts).toHaveProperty('daoDeGenJar');

    // All contract addresses should be hex strings
    for (const key of Object.keys(data.contracts)) {
      expect(data.contracts[key]).toMatch(/^0x[0-9a-fA-F]+$/);
    }
  });

  it('capabilities array contains register, update, revoke', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.capabilities).toEqual(['register', 'update', 'revoke']);
  });

  it('authentication block specifies SIWE method', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.authentication.method).toBe('SIWE');
    expect(data.authentication.nonceEndpoint).toBe('/api/auth/nonce');
    expect(data.authentication.verifyEndpoint).toBe('/api/auth/verify');
  });

  it('api section includes verseOracle and verses', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.api).toHaveProperty('verseOracle');
    expect(data.api).toHaveProperty('verses');
  });

  it('verseOracle has x402 payment protocol', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.api.verseOracle.payment.protocol).toBe('x402');
    expect(data.api.verseOracle.payment.asset).toBe('USDC');
    expect(data.api.verseOracle.payment.chain).toBe('Unichain');
  });

  it('verses section reports 81 verse count', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.api.verses.count).toBe(81);
  });

  it('verseOracle endpoints include singleVerse, verseList, and metadata', async () => {
    const response = await GET();
    const data = await response.json();

    const endpoints = data.api.verseOracle.endpoints;
    expect(endpoints).toHaveProperty('singleVerse');
    expect(endpoints).toHaveProperty('verseList');
    expect(endpoints).toHaveProperty('metadata');
    expect(endpoints.metadata).toBe('/api/verse/{id}/metadata');
  });

  it('returns application/json content-type', async () => {
    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('metadataPattern uses the {id} placeholder', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.api.verses.metadataPattern).toBe('/api/verse/{id}/metadata');
  });
});
