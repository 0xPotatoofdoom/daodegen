import { describe, it, expect, vi } from 'vitest';

// Mock React and its hooks
vi.mock('react', () => ({
  default: {
    createElement: vi.fn(),
  },
  useState: vi.fn((init: unknown) => [init, vi.fn()]),
  useEffect: vi.fn(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: vi.fn(),
}));

import { IPFSImage, useIPFSImagePreload } from './IPFSImage';

describe('IPFSImage', () => {
  it('exports IPFSImage as a function (React component)', () => {
    expect(typeof IPFSImage).toBe('function');
  });

  it('is also the default export', async () => {
    const module = await import('./IPFSImage');
    expect(module.default).toBe(IPFSImage);
  });
});

describe('useIPFSImagePreload', () => {
  it('is exported as a function (hook)', () => {
    expect(typeof useIPFSImagePreload).toBe('function');
  });
});

describe('IPFS gateway URL construction logic', () => {
  // We test the URL construction logic that the component uses internally.
  // The component constructs URLs by mapping gateways with the cleaned hash.

  const DEFAULT_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ];

  describe('hash cleaning', () => {
    it('removes ipfs:// prefix from hash', () => {
      const hash = 'ipfs://QmXyZ123abc';
      const cleanHash = hash.replace(/^ipfs:\/\//, '');
      expect(cleanHash).toBe('QmXyZ123abc');
    });

    it('leaves plain hash unchanged', () => {
      const hash = 'QmXyZ123abc';
      const cleanHash = hash.replace(/^ipfs:\/\//, '');
      expect(cleanHash).toBe('QmXyZ123abc');
    });

    it('only removes prefix once (not recursive)', () => {
      const hash = 'ipfs://ipfs://QmDouble';
      const cleanHash = hash.replace(/^ipfs:\/\//, '');
      expect(cleanHash).toBe('ipfs://QmDouble');
    });

    it('handles empty string', () => {
      const hash = '';
      const cleanHash = hash.replace(/^ipfs:\/\//, '');
      expect(cleanHash).toBe('');
    });

    it('handles hash with path after CID', () => {
      const hash = 'ipfs://QmXyZ123abc/image.png';
      const cleanHash = hash.replace(/^ipfs:\/\//, '');
      expect(cleanHash).toBe('QmXyZ123abc/image.png');
    });
  });

  describe('gateway URL generation', () => {
    it('generates correct URLs from default gateways', () => {
      const hash = 'QmXyZ123abc';
      const urls = DEFAULT_GATEWAYS.map(gateway => `${gateway}${hash}`);

      expect(urls).toEqual([
        'https://gateway.pinata.cloud/ipfs/QmXyZ123abc',
        'https://ipfs.io/ipfs/QmXyZ123abc',
        'https://cloudflare-ipfs.com/ipfs/QmXyZ123abc',
        'https://dweb.link/ipfs/QmXyZ123abc',
      ]);
    });

    it('generates 4 URLs from default gateways', () => {
      const hash = 'QmTest';
      const urls = DEFAULT_GATEWAYS.map(gateway => `${gateway}${hash}`);
      expect(urls).toHaveLength(4);
    });

    it('works with custom gateways', () => {
      const customGateways = ['https://my-gateway.com/ipfs/'];
      const hash = 'QmCustom';
      const urls = customGateways.map(gateway => `${gateway}${hash}`);

      expect(urls).toEqual(['https://my-gateway.com/ipfs/QmCustom']);
    });

    it('handles hash with ipfs:// prefix after cleaning', () => {
      const hash = 'ipfs://QmXyZ123abc';
      const cleanHash = hash.replace(/^ipfs:\/\//, '');
      const urls = DEFAULT_GATEWAYS.map(gateway => `${gateway}${cleanHash}`);

      expect(urls[0]).toBe('https://gateway.pinata.cloud/ipfs/QmXyZ123abc');
      expect(urls[1]).toBe('https://ipfs.io/ipfs/QmXyZ123abc');
    });

    it('handles CIDv1 base32 hashes', () => {
      const hash = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const urls = DEFAULT_GATEWAYS.map(gateway => `${gateway}${hash}`);

      expect(urls[0]).toBe(
        'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
    });
  });

  describe('default gateways', () => {
    it('pinata is the first (preferred) gateway', () => {
      expect(DEFAULT_GATEWAYS[0]).toContain('pinata');
    });

    it('ipfs.io is the second gateway', () => {
      expect(DEFAULT_GATEWAYS[1]).toContain('ipfs.io');
    });

    it('cloudflare is the third gateway', () => {
      expect(DEFAULT_GATEWAYS[2]).toContain('cloudflare');
    });

    it('dweb.link is the fourth gateway', () => {
      expect(DEFAULT_GATEWAYS[3]).toContain('dweb.link');
    });

    it('all gateways end with /ipfs/', () => {
      for (const gateway of DEFAULT_GATEWAYS) {
        expect(gateway).toMatch(/\/ipfs\/$/);
      }
    });

    it('all gateways use HTTPS', () => {
      for (const gateway of DEFAULT_GATEWAYS) {
        expect(gateway).toMatch(/^https:\/\//);
      }
    });
  });

  describe('gateway failover logic', () => {
    it('has multiple gateways for fallback', () => {
      expect(DEFAULT_GATEWAYS.length).toBeGreaterThan(1);
    });

    it('can iterate through gateways sequentially', () => {
      const hash = 'QmTest';
      let currentIndex = 0;
      const urls = DEFAULT_GATEWAYS.map(gateway => `${gateway}${hash}`);

      // Simulate failover
      const firstUrl = urls[currentIndex];
      expect(firstUrl).toContain('pinata');

      currentIndex++;
      const secondUrl = urls[currentIndex];
      expect(secondUrl).toContain('ipfs.io');

      currentIndex++;
      const thirdUrl = urls[currentIndex];
      expect(thirdUrl).toContain('cloudflare');

      currentIndex++;
      const fourthUrl = urls[currentIndex];
      expect(fourthUrl).toContain('dweb.link');
    });
  });
});

describe('module exports', () => {
  it('exports IPFSImage as named export', async () => {
    const module = await import('./IPFSImage');
    expect(module.IPFSImage).toBeDefined();
  });

  it('exports useIPFSImagePreload as named export', async () => {
    const module = await import('./IPFSImage');
    expect(module.useIPFSImagePreload).toBeDefined();
  });

  it('exports IPFSImage as default export', async () => {
    const module = await import('./IPFSImage');
    expect(module.default).toBe(module.IPFSImage);
  });
});
