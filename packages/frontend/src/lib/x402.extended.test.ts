import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track the money parser callback so we can test it
let capturedMoneyParser: ((amount: number, network: string) => Promise<any>) | null = null;

// Track the patched initialize so we can test the error-swallowing behaviour
let mockOriginalInitialize = vi.fn().mockResolvedValue(undefined);
const mockBuildPaymentRequirements = vi.fn();
let patchedServer: any = null;

vi.mock('@x402/core/http', () => {
  return {
    HTTPFacilitatorClient: class MockHTTPFacilitatorClient {
      url: string;
      constructor(opts: any) {
        this.url = opts.url;
      }
    },
  };
});

vi.mock('@x402/core/server', () => {
  return {
    x402ResourceServer: class MockX402ResourceServer {
      constructor(_client: any) {}
      register(_network: string, _scheme: any) {
        const server: any = {
          buildPaymentRequirements: mockBuildPaymentRequirements,
          initialize: mockOriginalInitialize,
        };
        patchedServer = server;
        return server;
      }
    },
  };
});

vi.mock('@x402/evm/exact/server', () => {
  return {
    ExactEvmScheme: class MockExactEvmScheme {
      registerMoneyParser(parser: any) {
        capturedMoneyParser = parser;
      }
    },
  };
});

vi.mock('./chain-config', () => ({
  chainConfig: {
    chainId: 1301,
    chainName: 'Unichain Sepolia',
    rpcUrl: 'https://sepolia.unichain.org',
    explorerUrl: 'https://sepolia.unichains.org',
    isTestnet: true,
  },
}));

describe('x402 extended coverage', () => {
  beforeEach(() => {
    vi.resetModules();
    capturedMoneyParser = null;
    patchedServer = null;
    mockOriginalInitialize = vi.fn().mockResolvedValue(undefined);
  });

  describe('money parser callback', () => {
    it('returns USDC config when network matches ACTIVE_CAIP2', async () => {
      const mod = await import('./x402');
      // Force lazy initialization so createX402Server runs and registers the money parser
      mod.getX402Server();
      expect(capturedMoneyParser).not.toBeNull();

      const result = await capturedMoneyParser!(0.5, 'eip155:1301');
      expect(result).toEqual({
        amount: '500000',
        asset: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
        extra: { name: 'USDC', version: '2' },
      });
    });

    it('rounds token amount correctly for small values', async () => {
      const mod = await import('./x402');
      mod.getX402Server();
      const result = await capturedMoneyParser!(0.001, 'eip155:1301');
      expect(result).toEqual({
        amount: '1000',
        asset: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
        extra: { name: 'USDC', version: '2' },
      });
    });

    it('returns null when network does not match ACTIVE_CAIP2', async () => {
      const mod = await import('./x402');
      mod.getX402Server();
      const result = await capturedMoneyParser!(1.0, 'eip155:1');
      expect(result).toBeNull();
    });

    it('returns null for completely unrelated network string', async () => {
      const mod = await import('./x402');
      mod.getX402Server();
      const result = await capturedMoneyParser!(1.0, 'solana:mainnet');
      expect(result).toBeNull();
    });
  });

  describe('getX402Server singleton', () => {
    it('returns the same instance on repeated calls', async () => {
      const mod = await import('./x402');
      const first = mod.getX402Server();
      const second = mod.getX402Server();
      expect(first).toBe(second);
    });
  });

  describe('initialize() error swallowing', () => {
    it('does not throw when original initialize rejects', async () => {
      mockOriginalInitialize.mockRejectedValueOnce(new Error('facilitator unreachable'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mod = await import('./x402');
      mod.getX402Server();
      expect(patchedServer).not.toBeNull();

      // The patched initialize should swallow the error
      await expect(patchedServer.initialize()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[x402] Facilitator unreachable'),
        expect.any(Error),
      );

      warnSpy.mockRestore();
    });

    it('succeeds silently when original initialize resolves', async () => {
      const mod = await import('./x402');
      mod.getX402Server();
      expect(patchedServer).not.toBeNull();

      await expect(patchedServer.initialize()).resolves.toBeUndefined();
    });
  });

  describe('x402Server proxy', () => {
    it('delegates method calls to the lazy server', async () => {
      const mod = await import('./x402');
      expect(typeof mod.x402Server.buildPaymentRequirements).toBe('function');
    });

    it('binds function properties to the server instance', async () => {
      const mod = await import('./x402');
      const fn = mod.x402Server.buildPaymentRequirements;
      expect(typeof fn).toBe('function');
    });

    it('returns non-function properties directly', async () => {
      const mod = await import('./x402');
      const server = mod.getX402Server() as any;
      server.someProp = 42;
      expect((mod.x402Server as any).someProp).toBe(42);
    });
  });

  describe('x402Server proxy error path', () => {
    it('returns a stub function that throws when getX402Server fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Override the ExactEvmScheme mock to throw during construction
      vi.doMock('@x402/evm/exact/server', () => ({
        ExactEvmScheme: class FailingScheme {
          constructor() {
            throw new Error('mock scheme construction failure');
          }
        },
      }));

      const freshMod = await import('./x402');

      // The proxy should not throw on property access
      const stubFn = freshMod.x402Server.buildPaymentRequirements;
      expect(typeof stubFn).toBe('function');

      // But calling the stub should throw
      expect(() => stubFn()).toThrow('[x402] Server unavailable (facilitator not running)');

      errorSpy.mockRestore();
    });

    it('returns undefined for symbol properties when server is unavailable', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.doMock('@x402/evm/exact/server', () => ({
        ExactEvmScheme: class FailingScheme {
          constructor() {
            throw new Error('mock scheme construction failure');
          }
        },
      }));

      const freshMod = await import('./x402');

      // Symbol property access when server fails should return undefined
      const sym = Symbol('test');
      const result = (freshMod.x402Server as any)[sym];
      expect(result).toBeUndefined();

      errorSpy.mockRestore();
    });
  });
});
