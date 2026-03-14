import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wagmi before importing the hook
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(),
  useBalance: vi.fn(),
}));

// Mock viem's formatEther
vi.mock('viem', () => ({
  formatEther: (value: bigint) => (Number(value) / 1e18).toString(),
}));

// Mock contracts
vi.mock('../lib/contracts', () => ({
  CONTRACT_ADDRESSES: {
    VERSE_NFT: '0xNFT',
    DAODEGEN_TOKEN: '0xTOKEN',
    DAODEGEN_JAR: '0xJAR',
  },
  VERSE_NFT_ABI: ['function totalSupply() view returns (uint256)'],
  DAODEGEN_TOKEN_ABI: ['function totalSupply() view returns (uint256)'],
  chainConfig: { chainId: 1301, chainName: 'Unichain Sepolia', rpcUrl: 'https://sepolia.unichain.org', isTestnet: true },
}));

import { useReadContract, useBalance } from 'wagmi';
import { useTokenStats } from './useTokenStats';

const mockUseReadContract = vi.mocked(useReadContract);
const mockUseBalance = vi.mocked(useBalance);

describe('useTokenStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function export', () => {
    expect(typeof useTokenStats).toBe('function');
  });

  it('returns default values when all data is loading', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useReadContract>);

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.nftsMinted).toBe('0');
    expect(result.jarBalance).toBe('0 ETH');
    expect(result.tokenTotalSupply).toBe('0 DDGEN');
    expect(result.totalNFTs).toBe('81');
    expect(result.isLoading).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns formatted values when data is available', () => {
    let callCount = 0;
    mockUseReadContract.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // NFT totalSupply call
        return {
          data: BigInt(42),
          isLoading: false,
          error: null,
        } as ReturnType<typeof useReadContract>;
      }
      // Token totalSupply call
      return {
        data: BigInt('1000000000000000000000'), // 1000 tokens (1000 * 1e18)
        isLoading: false,
        error: null,
      } as ReturnType<typeof useReadContract>;
    });

    mockUseBalance.mockReturnValue({
      data: {
        value: BigInt('2500000000000000000'), // 2.5 ETH
        decimals: 18,
        formatted: '2.5',
        symbol: 'ETH',
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.nftsMinted).toBe('42');
    expect(result.jarBalance).toBe('2.5000 ETH');
    expect(result.tokenTotalSupply).toContain('DDGEN');
    expect(result.tokenTotalSupply).toContain('1,000');
    expect(result.totalNFTs).toBe('81');
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
  });

  it('returns error message when NFT contract read fails', () => {
    const testError = new Error('Contract call failed');
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: testError,
    } as unknown as ReturnType<typeof useReadContract>);

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.error).toBe('Contract call failed');
    expect(result.isLoading).toBe(false);
  });

  it('returns error message when balance fetch fails', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useReadContract>);

    const testError = new Error('Balance fetch failed');
    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: testError,
    } as unknown as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.error).toBe('Balance fetch failed');
  });

  it('isLoading is true when any sub-query is still loading', () => {
    let callCount = 0;
    mockUseReadContract.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: BigInt(10), isLoading: false, error: null } as ReturnType<typeof useReadContract>;
      }
      return { data: undefined, isLoading: true, error: null } as ReturnType<typeof useReadContract>;
    });

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.isLoading).toBe(true);
  });

  it('formats NFT count as simple string', () => {
    let callCount = 0;
    mockUseReadContract.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: BigInt(0), isLoading: false, error: null } as ReturnType<typeof useReadContract>;
      }
      return { data: BigInt(0), isLoading: false, error: null } as ReturnType<typeof useReadContract>;
    });

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.nftsMinted).toBe('0');
  });

  it('formats jar balance with 4 decimal places', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useReadContract>);

    mockUseBalance.mockReturnValue({
      data: {
        value: BigInt('123456789012345678'), // ~0.1235 ETH
        decimals: 18,
        formatted: '0.123456789012345678',
        symbol: 'ETH',
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.jarBalance).toMatch(/^\d+\.\d{4} ETH$/);
    expect(result.jarBalance).toBe('0.1235 ETH');
  });

  it('formats token supply with locale string and DDGEN suffix', () => {
    let callCount = 0;
    mockUseReadContract.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: BigInt(5), isLoading: false, error: null } as ReturnType<typeof useReadContract>;
      }
      // 1,000,000 tokens = 1e24 raw
      return {
        data: BigInt('1000000000000000000000000'),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useReadContract>;
    });

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.tokenTotalSupply).toContain('DDGEN');
    expect(result.tokenTotalSupply).toContain('1,000,000');
  });

  it('totalNFTs always returns the hardcoded value 81', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useReadContract>);

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    expect(result.totalNFTs).toBe('81');
  });

  it('calls useReadContract with correct NFT contract parameters', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useReadContract>);

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    useTokenStats();

    // First call should be for NFT totalSupply
    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xNFT',
        functionName: 'totalSupply',
      })
    );

    // Second call should be for token totalSupply
    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xTOKEN',
        functionName: 'totalSupply',
      })
    );
  });

  it('calls useBalance with the jar contract address', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useReadContract>);

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    useTokenStats();

    expect(mockUseBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xJAR',
      })
    );
  });

  it('prioritizes first error found across all queries', () => {
    const nftError = new Error('NFT error');
    const tokenError = new Error('Token error');

    let callCount = 0;
    mockUseReadContract.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: undefined, isLoading: false, error: nftError } as unknown as ReturnType<typeof useReadContract>;
      }
      return { data: undefined, isLoading: false, error: tokenError } as unknown as ReturnType<typeof useReadContract>;
    });

    mockUseBalance.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBalance>);

    const result = useTokenStats();

    // Should return the first error (nftError due to || short-circuit)
    expect(result.error).toBe('NFT error');
  });
});
