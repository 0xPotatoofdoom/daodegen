import { describe, it, expect, vi } from 'vitest';

// Mock the verses JSON data
vi.mock('@/data/verses.json', () => ({
  default: [
    {
      id: 1,
      title: 'The Eternal Protocol',
      body: 'The protocol that can be forked...',
      alpha: 'The real protocol lives in the space between the docs and the code.',
      image: '/illustrations/verse-01-eternal-protocol-1024.png',
    },
    {
      id: 2,
      title: 'The Duality of Markets',
      body: 'When builders see a token as bullish...',
      alpha: 'The market is one thing pretending to be two.',
      image: '/illustrations/verse-02-the-duality-of-markets.png',
    },
    {
      id: 3,
      title: 'The Performance Protocol',
      body: 'If you promote mid-cap gems too loudly...',
      alpha: 'The loudest bag holder in the room is the exit liquidity.',
      image: '/illustrations/verse-03-do-not-display-your-bags.png',
    },
    {
      id: 81,
      title: 'The Final Verse',
      body: 'The last verse...',
      alpha: 'The end is also the beginning.',
      image: '/illustrations/verse-81-final.png',
    },
  ],
}));

import { verses, getVerseById } from './verses';

describe('verses', () => {
  it('exports a verses array', () => {
    expect(Array.isArray(verses)).toBe(true);
  });

  it('verses array is non-empty', () => {
    expect(verses.length).toBeGreaterThan(0);
  });

  it('each verse has the expected shape', () => {
    for (const verse of verses) {
      expect(verse).toHaveProperty('id');
      expect(verse).toHaveProperty('title');
      expect(verse).toHaveProperty('body');
      expect(verse).toHaveProperty('alpha');
      expect(verse).toHaveProperty('image');
    }
  });

  it('verse ids are numbers', () => {
    for (const verse of verses) {
      expect(typeof verse.id).toBe('number');
    }
  });

  it('verse titles are non-empty strings', () => {
    for (const verse of verses) {
      expect(typeof verse.title).toBe('string');
      expect(verse.title.length).toBeGreaterThan(0);
    }
  });

  it('verse bodies are non-empty strings', () => {
    for (const verse of verses) {
      expect(typeof verse.body).toBe('string');
      expect(verse.body.length).toBeGreaterThan(0);
    }
  });

  it('verse alpha values are non-empty strings', () => {
    for (const verse of verses) {
      expect(typeof verse.alpha).toBe('string');
      expect(verse.alpha.length).toBeGreaterThan(0);
    }
  });

  it('verse images are non-empty strings', () => {
    for (const verse of verses) {
      expect(typeof verse.image).toBe('string');
      expect(verse.image.length).toBeGreaterThan(0);
    }
  });
});

describe('getVerseById', () => {
  it('is a function export', () => {
    expect(typeof getVerseById).toBe('function');
  });

  it('returns correct verse for valid id', () => {
    const verse = getVerseById(1);

    expect(verse).not.toBeNull();
    expect(verse!.id).toBe(1);
    expect(verse!.title).toBe('The Eternal Protocol');
  });

  it('returns correct verse for id 2', () => {
    const verse = getVerseById(2);

    expect(verse).not.toBeNull();
    expect(verse!.id).toBe(2);
    expect(verse!.title).toBe('The Duality of Markets');
  });

  it('returns correct verse for the last verse (id 81)', () => {
    const verse = getVerseById(81);

    expect(verse).not.toBeNull();
    expect(verse!.id).toBe(81);
    expect(verse!.title).toBe('The Final Verse');
  });

  it('returns null for non-existent id', () => {
    const verse = getVerseById(999);
    expect(verse).toBeNull();
  });

  it('returns null for negative id', () => {
    const verse = getVerseById(-1);
    expect(verse).toBeNull();
  });

  it('returns null for zero id', () => {
    const verse = getVerseById(0);
    expect(verse).toBeNull();
  });

  it('returns a verse object with all expected fields', () => {
    const verse = getVerseById(3);

    expect(verse).not.toBeNull();
    expect(verse).toEqual({
      id: 3,
      title: 'The Performance Protocol',
      body: 'If you promote mid-cap gems too loudly...',
      alpha: 'The loudest bag holder in the room is the exit liquidity.',
      image: '/illustrations/verse-03-do-not-display-your-bags.png',
    });
  });
});
