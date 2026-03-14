import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verses', () => ({
  getVerseById: vi.fn(),
}));

import { GET } from './route';
import { getVerseById } from '@/lib/verses';

const mockedGetVerseById = vi.mocked(getVerseById);

function makeRequest(id: string) {
  return GET(
    new Request(`http://localhost/api/verse/${id}/metadata`) as any,
    { params: Promise.resolve({ id }) }
  );
}

const mockVerse = {
  id: 1,
  title: 'The Eternal Protocol',
  body: 'The protocol that can be forked is not the eternal protocol. The token that can be named is not the eternal token.',
  alpha: 'The real protocol lives in the space between the docs and the code.',
  image: '/illustrations/verse-01-eternal-protocol-1024.png',
};

describe('GET /api/verse/[id]/metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid NFT metadata for verse 1', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('The Eternal Protocol -- Verse #1');
    expect(data.description).toBe(mockVerse.alpha);
    expect(data.image).toContain('/illustrations/verse-01-eternal-protocol-1024.png');
    expect(data.external_url).toContain('/verse/1');
  });

  it('returns metadata with correct structure and fields', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');
    const data = await response.json();

    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('image');
    expect(data).toHaveProperty('external_url');
    expect(data).toHaveProperty('attributes');
    expect(Array.isArray(data.attributes)).toBe(true);
  });

  it('includes correct attributes array', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');
    const data = await response.json();

    expect(data.attributes).toEqual([
      {
        trait_type: 'Verse Number',
        display_type: 'number',
        value: 1,
      },
      {
        trait_type: 'Collection',
        value: 'Dao DeGen',
      },
      {
        trait_type: 'Source',
        value: 'Tao Te Ching (DeFi adaptation)',
      },
    ]);
  });

  it('uses body substring when alpha is empty', async () => {
    const verseNoAlpha = { ...mockVerse, alpha: '' };
    mockedGetVerseById.mockReturnValue(verseNoAlpha);

    const response = await makeRequest('1');
    const data = await response.json();

    // When alpha is empty/falsy, falls back to body.substring(0, 200)
    expect(data.description).toBe(verseNoAlpha.body.substring(0, 200));
  });

  it('returns 404 for verse ID 0 (below range)', async () => {
    const response = await makeRequest('0');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Invalid verse ID');
  });

  it('returns 404 for verse ID 82 (above range)', async () => {
    const response = await makeRequest('82');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Invalid verse ID');
  });

  it('returns 404 for non-numeric verse ID', async () => {
    const response = await makeRequest('abc');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Invalid verse ID');
  });

  it('returns 404 for negative verse ID', async () => {
    const response = await makeRequest('-1');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Invalid verse ID');
  });

  it('returns 404 when getVerseById returns null', async () => {
    mockedGetVerseById.mockReturnValue(null);

    const response = await makeRequest('50');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Verse not found.');
  });

  it('accepts verse ID 81 (upper boundary)', async () => {
    const verse81 = { ...mockVerse, id: 81, title: 'Verse 81' };
    mockedGetVerseById.mockReturnValue(verse81);

    const response = await makeRequest('81');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toContain('Verse 81');
  });

  it('accepts verse ID 1 (lower boundary)', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');

    expect(response.status).toBe(200);
  });

  it('sets cache-control header', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');
    const cacheControl = response.headers.get('cache-control');

    expect(cacheControl).toBe('public, max-age=86400, s-maxage=86400');
  });

  it('returns application/json content-type', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('passes correct verse ID to getVerseById', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    await makeRequest('42');

    expect(mockedGetVerseById).toHaveBeenCalledWith(42);
  });

  it('image URL contains the base URL prefix', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');
    const data = await response.json();

    // The image URL should be absolute (base URL + verse image path)
    expect(data.image).toMatch(/^https?:\/\/.+\/illustrations\//);
  });

  it('external_url contains the base URL prefix', async () => {
    mockedGetVerseById.mockReturnValue(mockVerse);

    const response = await makeRequest('1');
    const data = await response.json();

    expect(data.external_url).toMatch(/^https?:\/\/.+\/verse\/1$/);
  });
});
