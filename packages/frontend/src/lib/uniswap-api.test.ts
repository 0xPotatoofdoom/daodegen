import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkApproval,
  getQuote,
  createSwap,
  type QuoteResponse,
} from './uniswap-api'

describe('uniswap-api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ---------------------------------------------------------------------------
  // checkApproval
  // ---------------------------------------------------------------------------

  describe('checkApproval', () => {
    it('calls /api/swap with the check_approval endpoint and returns response data', async () => {
      const approvalData = {
        approval: {
          to: '0xABCDEF' as `0x${string}`,
          data: '0x1234' as `0x${string}`,
          value: '0',
          gasLimit: '50000',
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => approvalData,
      } as any)

      const result = await checkApproval({
        token: '0xtoken',
        amount: '1000000',
        chainId: 1,
        walletAddress: '0xwallet',
      })

      expect(fetch).toHaveBeenCalledWith(
        '/api/swap',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            endpoint: '/check_approval',
            params: {
              token: '0xtoken',
              amount: '1000000',
              chainId: 1,
              walletAddress: '0xwallet',
            },
          }),
        }),
      )
      expect(result).toEqual(approvalData)
    })

    it('returns null approval when no approval is required', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ approval: null }),
      } as any)

      const result = await checkApproval({
        token: '0xtoken',
        amount: '1000000',
        chainId: 1,
        walletAddress: '0xwallet',
      })

      expect(result.approval).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // getQuote
  // ---------------------------------------------------------------------------

  describe('getQuote', () => {
    it('calls /api/swap with the quote endpoint and returns the quote response', async () => {
      const quoteData: QuoteResponse = {
        requestId: 'req-1',
        routing: 'CLASSIC',
        quote: {
          input: { token: '0xin', amount: '1000' },
          output: { token: '0xout', amount: '990' },
          swapper: '0xswapper',
          chainId: 1,
          slippage: { tolerance: 0.5 },
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => quoteData,
      } as any)

      const result = await getQuote({
        type: 'EXACT_INPUT',
        tokenInChainId: 1,
        tokenOutChainId: 1,
        tokenIn: '0xin',
        tokenOut: '0xout',
        amount: '1000',
        swapper: '0xswapper',
        slippageTolerance: 0.5,
      })

      expect(fetch).toHaveBeenCalledWith(
        '/api/swap',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"endpoint":"/quote"'),
        }),
      )
      expect(result).toEqual(quoteData)
    })
  })

  // ---------------------------------------------------------------------------
  // createSwap
  // ---------------------------------------------------------------------------

  describe('createSwap', () => {
    it('returns methodParameters directly when quote contains them (no fetch)', async () => {
      const quoteWithMethod: QuoteResponse = {
        requestId: 'req-2',
        routing: 'CLASSIC',
        quote: {
          input: { token: '0xin', amount: '1000' },
          output: { token: '0xout', amount: '990' },
          swapper: '0xswapper',
          chainId: 1,
          slippage: { tolerance: 0.5 },
          methodParameters: {
            to: '0xrouter' as `0x${string}`,
            calldata: '0xcalldata' as `0x${string}`,
            value: '0',
          },
        },
      }

      const result = await createSwap(quoteWithMethod)

      expect(fetch).not.toHaveBeenCalled()
      expect(result).toEqual({
        to: '0xrouter',
        data: '0xcalldata',
        value: '0',
      })
    })

    it('calls /swap endpoint for CLASSIC routing without methodParameters', async () => {
      const swapTx = {
        to: '0xrouter' as `0x${string}`,
        data: '0xcalldata' as `0x${string}`,
        value: '0',
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => swapTx,
      } as any)

      const quoteClassic: QuoteResponse = {
        requestId: 'req-3',
        routing: 'CLASSIC',
        quote: {
          input: { token: '0xin', amount: '1000' },
          output: { token: '0xout', amount: '990' },
          swapper: '0xswapper',
          chainId: 1,
          slippage: { tolerance: 0.5 },
        },
      }

      const result = await createSwap(quoteClassic, '0xsignature')

      expect(fetch).toHaveBeenCalledWith(
        '/api/swap',
        expect.objectContaining({
          body: expect.stringContaining('"endpoint":"/swap"'),
        }),
      )
      expect(result).toEqual(swapTx)
    })

    it('calls /order endpoint for UniswapX routing', async () => {
      const orderTx = {
        to: '0xreactor' as `0x${string}`,
        data: '0xorderdata' as `0x${string}`,
        value: '0',
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => orderTx,
      } as any)

      const quoteUniswapX: QuoteResponse = {
        requestId: 'req-4',
        routing: 'DUTCH_LIMIT',
        quote: {
          input: { token: '0xin', amount: '1000' },
          output: { token: '0xout', amount: '990' },
          swapper: '0xswapper',
          chainId: 1,
          slippage: { tolerance: 0.5 },
        },
        permitData: {
          domain: { name: 'Permit2' },
          types: { PermitTransferFrom: [] },
          values: { permitted: { token: '0xin', amount: '1000' } },
        },
      }

      const result = await createSwap(quoteUniswapX, '0xpermitsig')

      expect(fetch).toHaveBeenCalledWith(
        '/api/swap',
        expect.objectContaining({
          body: expect.stringContaining('"endpoint":"/order"'),
        }),
      )
      expect(result).toEqual(orderTx)
    })
  })

  // ---------------------------------------------------------------------------
  // apiCall error path
  // ---------------------------------------------------------------------------

  describe('apiCall error handling', () => {
    it('throws an Error with the detail message when fetch returns non-ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Token not supported' }),
      } as any)

      await expect(
        checkApproval({
          token: '0xbad',
          amount: '0',
          chainId: 1,
          walletAddress: '0xwallet',
        }),
      ).rejects.toThrow('Token not supported')
    })

    it('throws an Error with errorCode when detail is absent', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ errorCode: 'INVALID_TOKEN' }),
      } as any)

      await expect(
        getQuote({
          type: 'EXACT_INPUT',
          tokenInChainId: 1,
          tokenOutChainId: 1,
          tokenIn: '0xbad',
          tokenOut: '0xout',
          amount: '1000',
          swapper: '0xswapper',
          slippageTolerance: 0.5,
        }),
      ).rejects.toThrow('INVALID_TOKEN')
    })

    it('throws with generic status message when json parse also fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => { throw new Error('not json') },
      } as any)

      await expect(
        checkApproval({
          token: '0xtoken',
          amount: '1000',
          chainId: 1,
          walletAddress: '0xwallet',
        }),
      ).rejects.toThrow('Service Unavailable')
    })
  })
})
