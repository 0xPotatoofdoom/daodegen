/**
 * direct-swap.ts
 *
 * Direct V4 swap via UniversalRouter for the DAODEGEN/ETH pool.
 *
 * WHY DIRECT: The Uniswap routing API doesn't allowlist custom hook pools —
 * the process is not permissionless and subject to internal review. We own the
 * pool key and know the exact route, so we build calldata ourselves.
 *
 * Works on both Unichain Sepolia (1301) and Unichain mainnet (130).
 *
 * UniversalRouter V4_SWAP flow:
 *   execute(commands=0x10, inputs=[routerPayload], deadline)
 *   routerPayload = abi.encode(actions, params)
 *     actions = [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
 */

import { createPublicClient, encodeAbiParameters, encodePacked, http, parseAbiParameters } from 'viem'

// ── Chain configs ─────────────────────────────────────────────────────────────

interface ChainAddresses {
  chainId:         number
  rpc:             string
  universalRouter: `0x${string}`
  stateView:       `0x${string}`
  daodegenToken:   `0x${string}`
  daodegenHook:    `0x${string}`
}

export const CHAIN_CONFIG: Record<number, ChainAddresses> = {
  1301: {
    chainId:         1301,
    rpc:             'https://sepolia.unichain.org',
    universalRouter: '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d',
    stateView:       '0xc199f1072a74d4e905aba1a84d9a45e2546b6222',
    daodegenToken:   '0x40e2809DDFD640A710308E492F8CFF0d8A81544A',  // v4 deploy 2026-03-19
    daodegenHook:    '0x44A04fe733BB985883430b6627e84B5f658Ec044',  // v4 hook re-mined 2026-03-19
  },
  130: {
    chainId:         130,
    rpc:             'https://mainnet.unichain.org',
    universalRouter: '0xEf740bf23acae26f6492b10de645d6b98dc8eaf3',
    stateView:       '0x86e8631a016f9068c3f085faf484ee3f5fdee8f2',
    daodegenToken:   '0x2719dcB70D7cA9DDbB018D7795Ee2F2A98f80947',
    daodegenHook:    '0x000FCDfd31d4a78b261A5256A1fD1EDbbc009937',
  },
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`

// Pool params — same across chains (deterministic from deployment)
const POOL_FEE         = 0
const TICK_SPACING     = 60

// UniversalRouter commands
const CMD_V4_SWAP       = 0x10

// V4Router actions
const ACT_SWAP_EXACT_IN_SINGLE = 0x06
const ACT_SETTLE_ALL           = 0x0c
const ACT_TAKE_ALL             = 0x0f

// ── StateView ABI (minimal) ───────────────────────────────────────────────────

const STATE_VIEW_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96',    type: 'uint160' },
      { name: 'tick',            type: 'int24'   },
      { name: 'protocolFee',     type: 'uint24'  },
      { name: 'lpFee',           type: 'uint24'  },
    ],
  },
  {
    name: 'getLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const

// ── Pool ID calculation ───────────────────────────────────────────────────────

function buildPoolKey(cfg: ChainAddresses) {
  return {
    currency0:   ADDRESS_ZERO,
    currency1:   cfg.daodegenToken as `0x${string}`,
    fee:         POOL_FEE,
    tickSpacing: TICK_SPACING,
    hooks:       cfg.daodegenHook as `0x${string}`,
  }
}

/**
 * Compute pool ID = keccak256(abi.encode(poolKey)) — matches V4 PoolId.toId()
 */
export function computePoolId(cfg: ChainAddresses): `0x${string}` {
  const { keccak256 } = require('viem')
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      'address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks',
    ),
    [ADDRESS_ZERO, cfg.daodegenToken as `0x${string}`, POOL_FEE, TICK_SPACING, cfg.daodegenHook as `0x${string}`],
  )
  return keccak256(encoded)
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export interface DirectQuote {
  amountIn:     bigint
  amountOut:    bigint
  amountOutMin: bigint
  sqrtPriceX96: bigint
  liquidity:    bigint
  /** 1% hook fee + any price impact */
  priceImpactPct: number
}

/**
 * Fetch a real quote using StateView + constant-product math.
 * Throws if the StateView call fails — no silent fallback.
 */
export async function fetchDirectQuote(
  chainId: number,
  amountIn: bigint,
  slippageBps: number = 50,
): Promise<DirectQuote> {
  const cfg = CHAIN_CONFIG[chainId]
  if (!cfg) throw new Error(`Unsupported chain ${chainId}`)
  if (cfg.daodegenToken === ADDRESS_ZERO || cfg.daodegenHook === ADDRESS_ZERO) {
    throw new Error('Mainnet swap not yet available — contract addresses not configured')
  }

  let sqrtPriceX96: bigint
  let liquidity: bigint

  try {
    const client = createPublicClient({
      transport: http(cfg.rpc),
    })

    const poolId = computePoolId(cfg)

    const [slot0, liq] = await Promise.all([
      client.readContract({
        address: cfg.stateView,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolId],
      }),
      client.readContract({
        address: cfg.stateView,
        abi: STATE_VIEW_ABI,
        functionName: 'getLiquidity',
        args: [poolId],
      }),
    ])

    sqrtPriceX96 = (slot0 as readonly [bigint, number, number, number])[0]
    liquidity    = liq as bigint
  } catch {
    throw new Error('Unable to fetch live quote — please try again.')
  }

  // Constant-product output calculation from sqrtPriceX96 and liquidity
  // For exact-input ETH → DAODEGEN (zeroForOne):
  //   amountOut ≈ L * (1/sqrtP_new - 1/sqrtP_old) (approximate for small trades)
  // Simplified: price = (sqrtPriceX96 / 2^96)^2  →  DAODEGEN per ETH
  const Q96 = 2n ** 96n
  // price in DAODEGEN per ETH (scaled by 1e18)
  const price = (sqrtPriceX96 * sqrtPriceX96 * 10n ** 18n) / (Q96 * Q96)

  // Gross output before hook fee
  const grossOut = (amountIn * price) / 10n ** 18n

  // Hook takes 1% from output
  const hookFee  = grossOut / 100n
  const amountOut = grossOut - hookFee

  // Slippage
  const amountOutMin = (amountOut * BigInt(10000 - slippageBps)) / 10000n

  const priceImpactPct = liquidity > 0n
    ? Number((amountIn * 10000n) / (liquidity * 2n)) / 100
    : 0

  return { amountIn, amountOut, amountOutMin, sqrtPriceX96, liquidity, priceImpactPct }
}

// ── Calldata builder ──────────────────────────────────────────────────────────

/**
 * Build UniversalRouter calldata for ETH → DAODEGEN exact-input swap.
 */
export function buildSwapCalldata(
  cfg: ChainAddresses,
  amountIn: bigint,
  amountOutMin: bigint,
  deadlineSecs: number,
): { to: `0x${string}`; data: `0x${string}`; value: bigint } {
  if (cfg.daodegenToken === ADDRESS_ZERO || cfg.daodegenHook === ADDRESS_ZERO) {
    throw new Error('Mainnet swap not yet available — contract addresses not configured')
  }

  const poolKey = buildPoolKey(cfg)

  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [ACT_SWAP_EXACT_IN_SINGLE, ACT_SETTLE_ALL, ACT_TAKE_ALL],
  )

  const swapParams = encodeAbiParameters(
    parseAbiParameters(
      '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData',
    ),
    [poolKey, true, amountIn, amountOutMin, '0x'],
  )

  const settleParams = encodeAbiParameters(
    parseAbiParameters('address currency, uint256 maxAmount'),
    [ADDRESS_ZERO, amountIn],
  )

  const takeParams = encodeAbiParameters(
    parseAbiParameters('address currency, uint256 minAmount'),
    [cfg.daodegenToken as `0x${string}`, amountOutMin],
  )

  const routerPayload = encodeAbiParameters(
    parseAbiParameters('bytes actions, bytes[] params'),
    [actions, [swapParams, settleParams, takeParams]],
  )

  // execute(bytes commands, bytes[] inputs, uint256 deadline)
  const executeSelector = '0x3593564c'
  const executeArgs = encodeAbiParameters(
    parseAbiParameters('bytes commands, bytes[] inputs, uint256 deadline'),
    [
      encodePacked(['uint8'], [CMD_V4_SWAP]),
      [routerPayload],
      BigInt(deadlineSecs),
    ],
  )

  return {
    to:    cfg.universalRouter,
    data:  (executeSelector + executeArgs.slice(2)) as `0x${string}`,
    value: amountIn,
  }
}

export { POOL_FEE, TICK_SPACING, ADDRESS_ZERO }
