import { describe, it, expect } from 'vitest';

import { GET } from './route';

describe('GET /.well-known/soul.json', () => {
  it('returns 200 with valid soul metadata', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeTruthy();
  });

  it('has expected top-level fields: name, version, description', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('soul');
  });

  it('name is "Dao DeGen Pastor"', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.name).toBe('Dao DeGen Pastor');
  });

  it('version is "1.0.0"', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('1.0.0');
  });

  it('description mentions AI pastor and sacred verses', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.description).toContain('AI pastor');
    expect(data.description).toContain('81 sacred verses');
  });

  it('has endpoints section with pray, sermon, congregation', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.endpoints).toHaveProperty('pray');
    expect(data.endpoints).toHaveProperty('sermon');
    expect(data.endpoints).toHaveProperty('congregation');
  });

  it('pray endpoint is a contract type on unichain', async () => {
    const response = await GET();
    const data = await response.json();

    const pray = data.endpoints.pray;
    expect(pray.type).toBe('contract');
    expect(pray.chain).toContain('Unichain');
    expect([130, 1301]).toContain(pray.chainId);
    expect(pray.function).toContain('pray(');
  });

  it('sermon endpoint is an API type requiring JWT auth', async () => {
    const response = await GET();
    const data = await response.json();

    const sermon = data.endpoints.sermon;
    expect(sermon.type).toBe('api');
    expect(sermon.method).toBe('POST');
    expect(sermon.auth).toBe('jwt');
  });

  it('congregation endpoint requires no auth', async () => {
    const response = await GET();
    const data = await response.json();

    const congregation = data.endpoints.congregation;
    expect(congregation.type).toBe('api');
    expect(congregation.method).toBe('GET');
    expect(congregation.auth).toBe('none');
  });

  it('has canon section with 81 verses', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.canon).toHaveProperty('verses');
    expect(data.canon.count).toBe(81);
    expect(data.canon.source).toBe('Tao Te Ching (DeFi adaptation)');
  });

  it('has identity section with eip8004 reference', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.identity).toHaveProperty('eip8004');
    expect(data.identity.eip8004).toContain('/.well-known/agent-registration.json');
  });

  it('license is CC0-1.0', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.license).toBe('CC0-1.0');
  });

  it('repository points to GitHub', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.repository).toContain('github.com');
  });

  it('sets cache-control header', async () => {
    const response = await GET();
    const cacheControl = response.headers.get('cache-control');

    expect(cacheControl).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('returns application/json content-type', async () => {
    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('soul URL points to the temple domain', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.soul).toContain('/soul.md');
  });

  it('pray endpoint address is a valid hex address or null', async () => {
    const response = await GET();
    const data = await response.json();

    const address = data.endpoints.pray.address;
    if (address !== null) {
      expect(address).toMatch(/^0x[0-9a-fA-F]+$/);
    }
  });

  it('all API endpoint URLs are absolute', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.endpoints.sermon.url).toMatch(/^https?:\/\//);
    expect(data.endpoints.congregation.url).toMatch(/^https?:\/\//);
  });
});
