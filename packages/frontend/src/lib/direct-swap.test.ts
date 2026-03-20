import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createPublicClient but keep real encoding functions
const mockReadContract = vi.fn();
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: mockReadContract,
    }),
  };
});

import {
  CHAIN_CONFIG,
  computePoolId,
  fetchDirectQuote,
  buildSwapCalldata,
  POOL_FEE,
  TICK_SPACING,
  ADDRESS_ZERO,
} from "./direct-swap";

describe("direct-swap", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  // ── CHAIN_CONFIG ──────────────────────────────────────────────────────

  describe("CHAIN_CONFIG", () => {
    it("has entries for 1301 and 130", () => {
      expect(CHAIN_CONFIG[1301]).toBeDefined();
      expect(CHAIN_CONFIG[130]).toBeDefined();
    });

    it("chain 1301 has correct fields", () => {
      const cfg = CHAIN_CONFIG[1301];
      expect(cfg.chainId).toBe(1301);
      expect(cfg.rpc).toBe("https://sepolia.unichain.org");
      expect(cfg.universalRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(cfg.stateView).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(cfg.daodegenToken).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(cfg.daodegenHook).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  // ── computePoolId ─────────────────────────────────────────────────────

  describe("computePoolId", () => {
    it("returns a bytes32 hex string for chain 1301", () => {
      const poolId = computePoolId(CHAIN_CONFIG[1301]);
      expect(poolId).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it("returns different IDs for different chains", () => {
      const id1301 = computePoolId(CHAIN_CONFIG[1301]);
      const id130 = computePoolId(CHAIN_CONFIG[130]);
      expect(id1301).not.toBe(id130);
    });
  });

  // ── fetchDirectQuote ──────────────────────────────────────────────────

  describe("fetchDirectQuote", () => {
    it("throws on unsupported chain", async () => {
      await expect(fetchDirectQuote(999, 1000000000000000000n)).rejects.toThrow(
        "Unsupported chain 999"
      );
    });

    it("returns quote with expected fields when StateView returns data", async () => {
      // sqrtPriceX96 = 2^96 means price = 1 DAODEGEN per ETH
      const sqrtPrice = 2n ** 96n;
      mockReadContract
        .mockResolvedValueOnce([sqrtPrice, 0, 0, 0]) // getSlot0
        .mockResolvedValueOnce(1000000000000000000n); // getLiquidity

      const quote = await fetchDirectQuote(1301, 1000000000000000000n);

      expect(quote.amountIn).toBe(1000000000000000000n);
      expect(quote.amountOut).toBeTypeOf("bigint");
      expect(quote.amountOutMin).toBeTypeOf("bigint");
      expect(quote.sqrtPriceX96).toBe(sqrtPrice);
      expect(quote.liquidity).toBe(1000000000000000000n);
      expect(typeof quote.priceImpactPct).toBe("number");
    });

    it("applies slippage correctly", async () => {
      const sqrtPrice = 2n ** 96n;
      mockReadContract
        .mockResolvedValueOnce([sqrtPrice, 0, 0, 0])
        .mockResolvedValueOnce(1000000000000000000n);

      const quote = await fetchDirectQuote(1301, 1000000000000000000n, 100); // 1% slippage

      // amountOutMin should be 99% of amountOut
      const expected = (quote.amountOut * 9900n) / 10000n;
      expect(quote.amountOutMin).toBe(expected);
    });

    it("throws when StateView call fails", async () => {
      mockReadContract.mockRejectedValue(new Error("RPC error"));

      await expect(fetchDirectQuote(1301, 1000000000000000000n)).rejects.toThrow(
        "Unable to fetch live quote"
      );
    });

    it("works for mainnet (130) which has non-zero addresses", async () => {
      const sqrtPrice = 2n ** 96n;
      mockReadContract
        .mockResolvedValueOnce([sqrtPrice, 0, 0, 0])
        .mockResolvedValueOnce(1000000000000000000n);

      const quote = await fetchDirectQuote(130, 500000000000000000n);

      expect(quote.amountIn).toBe(500000000000000000n);
      expect(quote.amountOut).toBeGreaterThan(0n);
    });
  });

  // ── buildSwapCalldata ─────────────────────────────────────────────────

  describe("buildSwapCalldata", () => {
    const cfg = CHAIN_CONFIG[1301];
    const amountIn = 1000000000000000000n;
    const amountOutMin = 900000000000000000n;
    const deadline = Math.floor(Date.now() / 1000) + 600;

    it("returns { to, data, value } with correct types", () => {
      const result = buildSwapCalldata(cfg, amountIn, amountOutMin, deadline);
      expect(result).toHaveProperty("to");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("value");
      expect(typeof result.to).toBe("string");
      expect(typeof result.data).toBe("string");
      expect(typeof result.value).toBe("bigint");
    });

    it("value equals amountIn", () => {
      const result = buildSwapCalldata(cfg, amountIn, amountOutMin, deadline);
      expect(result.value).toBe(amountIn);
    });

    it("to equals universalRouter address", () => {
      const result = buildSwapCalldata(cfg, amountIn, amountOutMin, deadline);
      expect(result.to).toBe(cfg.universalRouter);
    });

    it("data starts with execute selector 0x3593564c", () => {
      const result = buildSwapCalldata(cfg, amountIn, amountOutMin, deadline);
      expect(result.data.startsWith("0x3593564c")).toBe(true);
    });

    it("data is valid hex", () => {
      const result = buildSwapCalldata(cfg, amountIn, amountOutMin, deadline);
      expect(result.data).toMatch(/^0x[0-9a-fA-F]+$/);
    });
  });

  // ── Exported constants ────────────────────────────────────────────────

  describe("exported constants", () => {
    it("POOL_FEE is 0", () => {
      expect(POOL_FEE).toBe(0);
    });

    it("TICK_SPACING is 60", () => {
      expect(TICK_SPACING).toBe(60);
    });

    it("ADDRESS_ZERO is the zero address", () => {
      expect(ADDRESS_ZERO).toBe("0x0000000000000000000000000000000000000000");
    });
  });
});
