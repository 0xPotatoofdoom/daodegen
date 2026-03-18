import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture what getDefaultConfig is called with
let capturedConfig: Record<string, unknown> | null = null;

// Mock @rainbow-me/rainbowkit
vi.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: vi.fn((config: Record<string, unknown>) => {
    capturedConfig = config;
    return { _type: 'wagmi-config', ...config };
  }),
}));

// Mock wagmi
vi.mock('wagmi', () => ({
  http: vi.fn((url?: string) => ({ _transport: 'http', url })),
}));

// Mock wagmi/chains
vi.mock('wagmi/chains', () => ({
  arbitrum: { id: 42161, name: 'Arbitrum One' },
  base: { id: 8453, name: 'Base' },
  mainnet: { id: 1, name: 'Ethereum' },
  polygon: { id: 137, name: 'Polygon' },
}));

describe('wagmi config', () => {
  beforeEach(() => {
    capturedConfig = null;
    // Clear module cache so env changes take effect
    vi.resetModules();
  });

  it('exports a config object', async () => {
    const { config } = await import('./wagmi');
    expect(config).toBeDefined();
  });

  it('creates config with correct app name', async () => {
    const { config } = await import('./wagmi');
    expect(capturedConfig).not.toBeNull();
    expect(capturedConfig!.appName).toBe('Dao DeGen');
  });

  it('enables SSR mode for Next.js', async () => {
    const { config } = await import('./wagmi');
    expect(capturedConfig!.ssr).toBe(true);
  });

  it('sets polling interval to 3000ms', async () => {
    const { config } = await import('./wagmi');
    expect(capturedConfig!.pollingInterval).toBe(3_000);
  });

  it('includes unichain as the first chain', async () => {
    const { config } = await import('./wagmi');
    const chains = capturedConfig!.chains as Array<{ id: number; name: string }>;
    expect(chains[0].id).toBe(130);
    expect(chains[0].name).toBe('Unichain');
  });

  it('includes Unichain Sepolia testnet', async () => {
    const { config } = await import('./wagmi');
    const chains = capturedConfig!.chains as Array<{ id: number; name: string }>;
    const chainIds = chains.map((c) => c.id);

    expect(chainIds).toContain(1301);   // Unichain Sepolia
  });

  it('configures 2 chains total (Unichain mainnet + Sepolia)', async () => {
    const { config } = await import('./wagmi');
    const chains = capturedConfig!.chains as Array<{ id: number }>;
    expect(chains).toHaveLength(2);
  });

  describe('unichain chain definition', () => {
    it('has chain ID 130', async () => {
      const { config } = await import('./wagmi');
      const chains = capturedConfig!.chains as Array<{ id: number; name: string }>;
      const unichain = chains.find((c) => c.name === 'Unichain');

      expect(unichain).toBeDefined();
      expect(unichain!.id).toBe(130);
    });

    it('is not a testnet', async () => {
      const { config } = await import('./wagmi');
      const chains = capturedConfig!.chains as Array<{ id: number; name: string; testnet?: boolean }>;
      const unichain = chains.find((c) => c.name === 'Unichain');

      expect(unichain!.testnet).toBe(false);
    });

    it('uses ETH as native currency', async () => {
      const { config } = await import('./wagmi');
      const chains = capturedConfig!.chains as Array<{
        id: number;
        name: string;
        nativeCurrency?: { symbol: string; decimals: number; name: string };
      }>;
      const unichain = chains.find((c) => c.name === 'Unichain');

      expect(unichain!.nativeCurrency).toEqual({
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
      });
    });

    it('has default RPC URL of https://mainnet.unichain.org', async () => {
      // Ensure env is not set for this test
      delete process.env.NEXT_PUBLIC_UNICHAIN_RPC;
      vi.resetModules();

      // Re-mock dependencies after module reset
      vi.doMock('@rainbow-me/rainbowkit', () => ({
        getDefaultConfig: vi.fn((config: Record<string, unknown>) => {
          capturedConfig = config;
          return { _type: 'wagmi-config', ...config };
        }),
      }));
      vi.doMock('wagmi', () => ({
        http: vi.fn((url?: string) => ({ _transport: 'http', url })),
      }));
      vi.doMock('wagmi/chains', () => ({
        arbitrum: { id: 42161, name: 'Arbitrum One' },
        base: { id: 8453, name: 'Base' },
        mainnet: { id: 1, name: 'Ethereum' },
        polygon: { id: 137, name: 'Polygon' },
      }));

      const { config } = await import('./wagmi');
      const chains = capturedConfig!.chains as Array<{
        id: number;
        name: string;
        rpcUrls?: { default: { http: string[] } };
      }>;
      const unichain = chains.find((c) => c.name === 'Unichain');

      expect(unichain!.rpcUrls!.default.http).toContain(
        'https://mainnet.unichain.org'
      );
    });

    it('has UnichainScan block explorer', async () => {
      const { config } = await import('./wagmi');
      const chains = capturedConfig!.chains as Array<{
        id: number;
        name: string;
        blockExplorers?: { default: { name: string; url: string } };
      }>;
      const unichain = chains.find((c) => c.name === 'Unichain');

      expect(unichain!.blockExplorers!.default.name).toBe('UnichainScan');
      expect(unichain!.blockExplorers!.default.url).toBe('https://unichains.org');
    });
  });

  describe('RPC configuration', () => {
    it('uses env var override for RPC when NEXT_PUBLIC_UNICHAIN_RPC is set', async () => {
      process.env.NEXT_PUBLIC_UNICHAIN_RPC = 'https://custom-rpc.example.com';
      vi.resetModules();

      // Re-mock dependencies after module reset
      vi.doMock('@rainbow-me/rainbowkit', () => ({
        getDefaultConfig: vi.fn((config: Record<string, unknown>) => {
          capturedConfig = config;
          return { _type: 'wagmi-config', ...config };
        }),
      }));
      vi.doMock('wagmi', () => ({
        http: vi.fn((url?: string) => ({ _transport: 'http', url })),
      }));
      vi.doMock('wagmi/chains', () => ({
        arbitrum: { id: 42161, name: 'Arbitrum One' },
        base: { id: 8453, name: 'Base' },
        mainnet: { id: 1, name: 'Ethereum' },
        polygon: { id: 137, name: 'Polygon' },
      }));

      const { config } = await import('./wagmi');
      const chains = capturedConfig!.chains as Array<{
        id: number;
        name: string;
        rpcUrls?: { default: { http: string[] } };
      }>;
      const unichain = chains.find((c) => c.name === 'Unichain');

      expect(unichain!.rpcUrls!.default.http).toContain(
        'https://custom-rpc.example.com'
      );

      // Cleanup
      delete process.env.NEXT_PUBLIC_UNICHAIN_RPC;
    });
  });

  describe('wallet connect project ID', () => {
    it('falls back to demo-project-id when env var is not set', async () => {
      delete process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
      vi.resetModules();

      vi.doMock('@rainbow-me/rainbowkit', () => ({
        getDefaultConfig: vi.fn((config: Record<string, unknown>) => {
          capturedConfig = config;
          return { _type: 'wagmi-config', ...config };
        }),
      }));
      vi.doMock('wagmi', () => ({
        http: vi.fn((url?: string) => ({ _transport: 'http', url })),
      }));
      vi.doMock('wagmi/chains', () => ({
        arbitrum: { id: 42161, name: 'Arbitrum One' },
        base: { id: 8453, name: 'Base' },
        mainnet: { id: 1, name: 'Ethereum' },
        polygon: { id: 137, name: 'Polygon' },
      }));

      const { config } = await import('./wagmi');

      expect(capturedConfig!.projectId).toBe('demo-project-id');
    });
  });
});
