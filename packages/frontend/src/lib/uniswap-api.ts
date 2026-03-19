export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000'

let _authToken: string | null = null

/** Set the JWT auth token used for swap API calls. */
export function setSwapAuthToken(token: string | null) {
  _authToken = token
}

async function apiCall<T>(endpoint: string, params: object): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`
  }

  const res = await fetch('/api/swap', {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint, params }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || error.errorCode || `API error: ${res.status}`)
  }

  return res.json()
}

// --- Check Approval ---

export interface CheckApprovalParams {
  token: string
  amount: string
  chainId: number
  walletAddress: string
}

export interface CheckApprovalResponse {
  approval: {
    to: `0x${string}`
    data: `0x${string}`
    value: string
    gasLimit: string
  } | null
}

export function checkApproval(params: CheckApprovalParams): Promise<CheckApprovalResponse> {
  return apiCall('/check_approval', params)
}

// --- Quote ---

export interface QuoteParams {
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT'
  tokenInChainId: number
  tokenOutChainId: number
  tokenIn: string
  tokenOut: string
  amount: string
  swapper: string
  slippageTolerance: number
  hooksOptions?: string
}

export interface QuoteResponse {
  requestId: string
  routing: string
  quote: {
    input: { token: string; amount: string }
    output: { token: string; amount: string }
    swapper: string
    chainId: number
    slippage: { tolerance: number }
    gasFeeUSD?: string
    gasFee?: string
    priceImpact?: number
    routeString?: string
    methodParameters?: {
      to: `0x${string}`
      calldata: `0x${string}`
      value: string
    }
    [key: string]: unknown
  }
  permitData?: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    values: Record<string, unknown>
  }
}

export function getQuote(params: QuoteParams): Promise<QuoteResponse> {
  return apiCall('/quote', params)
}

// --- Swap (Classic) / Order (UniswapX) ---

export interface SwapTransaction {
  to: `0x${string}`
  data: `0x${string}`
  value: string
  gasLimit?: string
  chainId?: number
}

export async function createSwap(
  quoteResponse: QuoteResponse,
  signature?: string,
): Promise<SwapTransaction> {
  // For CLASSIC routing with methodParameters already in quote
  if (quoteResponse.quote.methodParameters) {
    return {
      to: quoteResponse.quote.methodParameters.to,
      data: quoteResponse.quote.methodParameters.calldata,
      value: quoteResponse.quote.methodParameters.value,
    }
  }

  // For routes that need a separate swap/order call
  const isUniswapX = quoteResponse.routing !== 'CLASSIC'
  const endpoint = isUniswapX ? '/order' : '/swap'

  return apiCall(endpoint, {
    quote: quoteResponse.quote,
    signature,
    permitData: quoteResponse.permitData,
  })
}
