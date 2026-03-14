import { z } from "zod";
import { type Chain } from "viem";
import { unichainSepolia, unichain } from "viem/chains";

const CHAIN_PRESETS = {
  sepolia: {
    chain: unichainSepolia,
    rpcUrl: "https://sepolia.unichain.org",
  },
  mainnet: {
    chain: unichain,
    rpcUrl: "https://mainnet.unichain.org",
  },
} as const;

type ActiveChain = keyof typeof CHAIN_PRESETS;

const schema = z.object({
  DAODEGEN_API_URL: z
    .string()
    .url()
    .describe("Base URL of the Dao DeGen API"),
  DAODEGEN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional()
    .describe("Hex private key for SIWE auth and x402 payments"),
  DAODEGEN_FACILITATOR_URL: z
    .string()
    .url()
    .optional()
    .describe("x402 facilitator URL (defaults to API URL's facilitator)"),
  ACTIVE_CHAIN: z
    .enum(["sepolia", "mainnet"])
    .default("sepolia")
    .describe("Active chain preset (sepolia | mainnet)"),
  DAODEGEN_RPC_URL: z
    .string()
    .url()
    .optional()
    .describe("Override RPC URL (defaults to preset for ACTIVE_CHAIN)"),
});

export type Config = z.infer<typeof schema>;

let _config: Config | undefined;

export function getConfig(): Config {
  if (_config) return _config;

  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid MCP server configuration:\n${issues}`);
  }

  // Resolve RPC URL default from chain preset
  const data = result.data;
  if (!data.DAODEGEN_RPC_URL) {
    data.DAODEGEN_RPC_URL = CHAIN_PRESETS[data.ACTIVE_CHAIN].rpcUrl;
  }

  _config = data;
  return _config;
}

export function getChain(): Chain {
  const config = getConfig();
  return CHAIN_PRESETS[config.ACTIVE_CHAIN as ActiveChain].chain;
}

export function hasPrivateKey(): boolean {
  return !!process.env.DAODEGEN_PRIVATE_KEY;
}
