import { HTTPFacilitatorClient } from "@x402/core/http";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { chainConfig } from "./chain-config";

// Chain config — driven by NEXT_PUBLIC_ACTIVE_CHAIN (see chain-config.ts)
const IS_MAINNET = !chainConfig.isTestnet;

const ACTIVE_CAIP2 = `eip155:${chainConfig.chainId}`;

// USDC on Unichain mainnet (130) vs Sepolia (1301)
const UNICHAIN_USDC = IS_MAINNET
  ? "0x078d782b760474a361dda0af3839290b0ef57ad6"  // Unichain mainnet USDC
  : "0x31d0220469e10c4E71834a79b1f276d740d3768F"; // Unichain Sepolia USDC

// Keep legacy name for backwards compat — typed for x402
const UNICHAIN_SEPOLIA_CAIP2 = ACTIVE_CAIP2 as `${string}:${string}`;

const facilitatorUrl = process.env.FACILITATOR_URL || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('FACILITATOR_URL must be set in production'); })()
    : "http://localhost:4402"
);

// Lazy-initialize the x402 server to avoid connecting to the facilitator at
// module load time (which breaks `next build` when the facilitator isn't running).
let _x402Server: ReturnType<typeof x402ResourceServer.prototype.register> | null = null;

function createX402Server() {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
  });

  const evmScheme = new ExactEvmScheme();
  evmScheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network === ACTIVE_CAIP2) {
      const decimals = 6;
      const tokenAmount = Math.round(amount * 10 ** decimals).toString();
      return {
        amount: tokenAmount,
        asset: UNICHAIN_USDC,
        extra: { name: "USDC", version: "2" },
      };
    }
    return null;
  });

  return new x402ResourceServer(facilitatorClient)
    .register(UNICHAIN_SEPOLIA_CAIP2, evmScheme);
}

export function getX402Server() {
  if (!_x402Server) {
    try {
      _x402Server = createX402Server();
    } catch (err) {
      console.error("[x402] Failed to initialize resource server:", err);
      throw err;
    }
  }
  return _x402Server;
}

// Keep the named export for backwards compatibility in routes that
// import x402Server directly -- but access it lazily.
export const x402Server = new Proxy({} as ReturnType<typeof x402ResourceServer.prototype.register>, {
  get(_target, prop, receiver) {
    const server = getX402Server();
    const value = Reflect.get(server, prop, receiver);
    return typeof value === 'function' ? value.bind(server) : value;
  },
});

const PAY_TO_RAW = process.env.X402_PAY_TO || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('X402_PAY_TO must be set in production'); })()
    : "0x3D0e10329c864A7422761af058f909267a776029"
);
export const PAY_TO = PAY_TO_RAW;
export const USDC_NETWORK = ACTIVE_CAIP2 as `${string}:${string}`;

// Three-tier pricing for the verse oracle
export const PRICE_LOOKUP = "$0.001";     // Tier 1: verse text + base interpretation
export const PRICE_COMMENTARY = "$0.01";  // Tier 2: contextual AI commentary
export const PRICE_ORACLE = "$0.10";      // Tier 3: AI-selected verse + reading
