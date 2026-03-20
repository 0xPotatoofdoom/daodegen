import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetTransactionReceipt,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => ({
  mockGetTransactionReceipt: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

// Mock viem
vi.mock("viem", () => ({
  createPublicClient: () => ({
    getTransactionReceipt: mockGetTransactionReceipt,
  }),
  http: () => ({}),
  decodeEventLog: vi.fn(),
}));

// Mock contracts
vi.mock("@/lib/contracts", () => ({
  CONTRACT_ADDRESSES: { PRAYER_BURN: "0xPrayerBurnAddress" },
  PRAYER_BURN_ABI: [],
}));

// Mock chain-config
vi.mock("@/lib/chain-config", () => ({
  chainConfig: { chainId: 1301, chainName: "Test", rpcUrl: "http://test" },
}));

// Mock Redis
vi.mock("@/lib/stores/redis", () => ({
  getRedis: () => ({ get: mockRedisGet, set: mockRedisSet }),
}));

import { decodeEventLog } from "viem";
import { verifyBurnTx, isBurnTxUsed, markBurnTxUsed } from "./verify-burn";

const TX_HASH = "0xabc123" as `0x${string}`;
const SENDER = "0xSenderAddress" as `0x${string}`;

describe("verifyBurnTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns BURN_TX_NOT_FOUND when receipt throws", async () => {
    mockGetTransactionReceipt.mockRejectedValue(new Error("not found"));

    const result = await verifyBurnTx(TX_HASH, SENDER);

    expect(result).toEqual({ ok: false, code: "BURN_TX_NOT_FOUND" });
  });

  it("returns BURN_TX_FAILED when status !== 'success'", async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: "reverted",
      to: "0xprayerburnaddress",
      logs: [],
    });

    const result = await verifyBurnTx(TX_HASH, SENDER);

    expect(result).toEqual({ ok: false, code: "BURN_TX_FAILED" });
  });

  it("returns BURN_TX_WRONG_CONTRACT when to doesn't match", async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: "success",
      to: "0xWrongContract",
      logs: [],
    });

    const result = await verifyBurnTx(TX_HASH, SENDER);

    expect(result).toEqual({ ok: false, code: "BURN_TX_WRONG_CONTRACT" });
  });

  it("returns BURN_TX_NO_EVENT when no Prayer event found", async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: "success",
      to: "0xPrayerBurnAddress",
      logs: [
        {
          address: "0xPrayerBurnAddress",
          data: "0x",
          topics: ["0xtopic"],
        },
      ],
    });

    vi.mocked(decodeEventLog).mockImplementation(() => {
      throw new Error("no matching event");
    });

    const result = await verifyBurnTx(TX_HASH, SENDER);

    expect(result).toEqual({ ok: false, code: "BURN_TX_NO_EVENT" });
  });

  it("returns BURN_TX_WRONG_SENDER when sender mismatch", async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: "success",
      to: "0xPrayerBurnAddress",
      logs: [
        {
          address: "0xPrayerBurnAddress",
          data: "0x",
          topics: ["0xtopic"],
        },
      ],
    });

    vi.mocked(decodeEventLog).mockReturnValue({
      eventName: "Prayer",
      args: {
        sender: "0xDifferentSender" as `0x${string}`,
        amount: 1000n,
        message: "0x" as `0x${string}`,
      },
    } as any);

    const result = await verifyBurnTx(TX_HASH, SENDER);

    expect(result).toEqual({ ok: false, code: "BURN_TX_WRONG_SENDER" });
  });

  it("returns ok:true with burnAmount and sender on success", async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      status: "success",
      to: "0xPrayerBurnAddress",
      logs: [
        {
          address: "0xPrayerBurnAddress",
          data: "0x",
          topics: ["0xtopic"],
        },
      ],
    });

    vi.mocked(decodeEventLog).mockReturnValue({
      eventName: "Prayer",
      args: {
        sender: SENDER,
        amount: 5000n,
        message: "0xdeadbeef" as `0x${string}`,
      },
    } as any);

    const result = await verifyBurnTx(TX_HASH, SENDER);

    expect(result).toEqual({ ok: true, burnAmount: 5000n, sender: SENDER });
  });
});

describe("isBurnTxUsed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when redis has value", async () => {
    mockRedisGet.mockResolvedValue("1234567890");

    const result = await isBurnTxUsed(TX_HASH);

    expect(result).toBe(true);
    expect(mockRedisGet).toHaveBeenCalledWith(`burn-tx:${TX_HASH}`);
  });

  it("returns false when redis returns null", async () => {
    mockRedisGet.mockResolvedValue(null);

    const result = await isBurnTxUsed(TX_HASH);

    expect(result).toBe(false);
    expect(mockRedisGet).toHaveBeenCalledWith(`burn-tx:${TX_HASH}`);
  });
});

describe("markBurnTxUsed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls redis.set with correct key", async () => {
    mockRedisSet.mockResolvedValue("OK");

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    await markBurnTxUsed(TX_HASH);

    expect(mockRedisSet).toHaveBeenCalledWith(
      `burn-tx:${TX_HASH}`,
      String(now)
    );

    vi.restoreAllMocks();
  });
});
