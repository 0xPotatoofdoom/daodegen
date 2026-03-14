import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted state -- available to mock factories before any imports
const { mockVerify, mockSiweState, mockReadContract } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockSiweState: {
    nonce: '',
    domain: 'localhost',
    chainId: 130,
    address: '0x1234567890abcdef1234567890abcdef12345678',
  },
  mockReadContract: vi.fn(),
}));

// Mock viem -- client created at module level in auth.ts uses mockReadContract
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
  http: vi.fn(),
  defineChain: vi.fn((c: unknown) => c),
}));

vi.mock('viem/chains', () => ({
  unichain: { id: 130, name: 'Unichain' },
  unichainSepolia: { id: 1301, name: 'Unichain Sepolia' },
}));

// Mock stores -- auth.ts imports createNonceStore
vi.mock('./stores', () => {
  const store = new Map<string, number>();
  return {
    createNonceStore: vi.fn(() => ({
      get: (k: string) => store.get(k),
      set: (k: string, v: number) => store.set(k, v),
      delete: (k: string) => store.delete(k),
      has: (k: string) => store.has(k),
      size: () => store.size,
      entries: () => store.entries(),
    })),
  };
});

// Mock contracts module
vi.mock('./contracts', () => ({
  CONTRACT_ADDRESSES: {
    AGENT_REGISTRY: '0x1234567890123456789012345678901234567890',
    JAR: '0x0000000000000000000000000000000000000001',
    VERSE_NFT: '0x0000000000000000000000000000000000000002',
    TOKEN: '0x0000000000000000000000000000000000000003',
    HOOK: '0x0000000000000000000000000000000000000004',
  },
  AGENT_REGISTRY_ABI: [],
}));

// Mock siwe with a proper class
vi.mock('siwe', () => ({
  generateNonce: vi.fn(() => 'mock-nonce-' + Math.random().toString(36).slice(2)),
  SiweMessage: class MockSiweMessage {
    nonce: string;
    domain: string;
    chainId: number;
    address: string;

    constructor(_input: string | Record<string, unknown>) {
      this.nonce = mockSiweState.nonce;
      this.domain = mockSiweState.domain;
      this.chainId = mockSiweState.chainId;
      this.address = mockSiweState.address;
    }

    verify(opts: Record<string, unknown>) {
      return mockVerify(opts);
    }

    prepareMessage() {
      return 'mock-prepared-message';
    }
  },
}));

import { getNonce, verifyAgentIdentity } from './auth';

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockReset();
  mockReadContract.mockReset();
  // Reset siwe state defaults
  mockSiweState.domain = 'localhost';
  mockSiweState.chainId = 130;
  mockSiweState.address = '0x1234567890abcdef1234567890abcdef12345678';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setupNonce(): string {
  const nonce = getNonce();
  mockSiweState.nonce = nonce;
  return nonce;
}

describe('verifyAgentIdentity - domain validation', () => {
  it('rejects disallowed domains', async () => {
    setupNonce();
    mockSiweState.domain = 'evil.com';

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xfake',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Domain not allowed');
  });

  it('accepts localhost domain', async () => {
    setupNonce();
    mockSiweState.domain = 'localhost';
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract
      .mockResolvedValueOnce(true)   // isAgent
      .mockResolvedValueOnce(42n);   // getAgentId

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('42');
  });

  it('strips port from domain before checking', async () => {
    setupNonce();
    mockSiweState.domain = 'localhost:3000';
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(1n);

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
  });

  it('accepts daodegen.com domain', async () => {
    setupNonce();
    mockSiweState.domain = 'daodegen.com';
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(5n);

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('5');
  });
});

describe('verifyAgentIdentity - chain ID validation', () => {
  it('rejects disallowed chain IDs', async () => {
    setupNonce();
    mockSiweState.chainId = 9999;

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xfake',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Chain ID not allowed');
    expect(result.error).toContain('9999');
  });

  it('accepts chain ID 130 (Unichain mainnet)', async () => {
    setupNonce();
    mockSiweState.chainId = 130;
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(1n);

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
  });

  it('accepts chain ID 1301 (Unichain Sepolia)', async () => {
    setupNonce();
    mockSiweState.chainId = 1301;
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(1n);

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
  });
});

describe('verifyAgentIdentity - signature verification', () => {
  it('returns error when verify result is not successful', async () => {
    setupNonce();
    mockVerify.mockResolvedValue({ success: false });

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xbad',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('catches verify() throwing and returns Invalid signature', async () => {
    setupNonce();
    mockVerify.mockRejectedValue(new Error('crypto error'));

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xbad',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });
});

describe('verifyAgentIdentity - agent registry', () => {
  it('returns dev-agent-1 when registry is zero address (dev mode)', async () => {
    vi.resetModules();

    vi.doMock('./contracts', () => ({
      CONTRACT_ADDRESSES: {
        AGENT_REGISTRY: '0x0000000000000000000000000000000000000000',
      },
      AGENT_REGISTRY_ABI: [],
    }));

    const origNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';

    const { getNonce: gn, verifyAgentIdentity: vai } = await import('./auth');
    const nonce = gn();
    mockSiweState.nonce = nonce;
    mockSiweState.domain = 'localhost';
    mockSiweState.chainId = 130;
    mockVerify.mockResolvedValue({ success: true });

    const result = await vai({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('dev-agent-1');
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
  });

  it('returns error when registry is zero address in production', async () => {
    vi.resetModules();

    vi.doMock('./contracts', () => ({
      CONTRACT_ADDRESSES: {
        AGENT_REGISTRY: '0x0000000000000000000000000000000000000000',
      },
      AGENT_REGISTRY_ABI: [],
    }));

    const origNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const { getNonce: gn, verifyAgentIdentity: vai } = await import('./auth');
    const nonce = gn();
    mockSiweState.nonce = nonce;
    mockSiweState.domain = 'daodegen.com';
    mockSiweState.chainId = 130;
    mockVerify.mockResolvedValue({ success: true });

    const result = await vai({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('AGENT_REGISTRY not configured');
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
  });

  it('returns success with user role when address is not a registered agent', async () => {
    setupNonce();
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract.mockResolvedValueOnce(false); // isAgent = false

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('user');
  });

  it('handles contract read failure gracefully — returns user role', async () => {
    setupNonce();
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract.mockRejectedValue(new Error('Contract call failed'));

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    // When contract read fails, isAgent stays false -> user role
    expect(result.success).toBe(true);
    expect(result.agentId).toBe('user');
  });

  it('returns success with agentId when address is a registered agent', async () => {
    setupNonce();
    mockVerify.mockResolvedValue({ success: true });
    mockReadContract
      .mockResolvedValueOnce(true)    // isAgent
      .mockResolvedValueOnce(99n);    // getAgentId

    const result = await verifyAgentIdentity({
      message: 'mock-message',
      signature: '0xvalid',
    });

    expect(result.success).toBe(true);
    expect(result.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(result.agentId).toBe('99');
  });
});

describe('getNonce', () => {
  it('generates unique nonces', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 10; i++) {
      nonces.add(getNonce());
    }
    expect(nonces.size).toBe(10);
  });
});
