import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jose
const mockJwtVerify = vi.fn();
vi.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

// Mock viem
vi.mock("viem", () => ({
  getAddress: (addr: string) => {
    // Simple checksum mock - just return lowercase for consistency
    if (!addr || addr === "invalid") throw new Error("Invalid address");
    return addr.toLowerCase();
  },
}));

// Mock env
vi.mock("@/lib/env", () => ({
  env: { JWT_SECRET: "test-secret-key-for-testing-purposes" },
}));

import { verifyJwt, walletMatchesJwt, type DaoDeGenJwtPayload } from "./jwt";

describe("verifyJwt", () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
  });

  it("returns payload on valid token", async () => {
    const payload = {
      sub: "0xABC123",
      walletAddress: "0xABC123",
      agentId: "agent-1",
    };
    mockJwtVerify.mockResolvedValue({ payload });

    const result = await verifyJwt("valid-token");

    expect(result).toEqual(payload);
    expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", expect.any(Uint8Array));
  });

  it("returns null on invalid/expired token (jwtVerify throws)", async () => {
    mockJwtVerify.mockRejectedValue(new Error("token expired"));

    const result = await verifyJwt("expired-token");

    expect(result).toBeNull();
  });

  it("returns null when wallet field is not a string", async () => {
    const payload = {
      sub: 12345,
      agentId: "agent-1",
    };
    mockJwtVerify.mockResolvedValue({ payload });

    const result = await verifyJwt("bad-wallet-token");

    expect(result).toBeNull();
  });

  it("uses walletAddress field when present", async () => {
    const payload = {
      sub: "0xOLD",
      walletAddress: "0xNEW",
      agentId: "agent-1",
    };
    mockJwtVerify.mockResolvedValue({ payload });

    const result = await verifyJwt("token-with-wallet");

    expect(result).toEqual(payload);
    expect(result!.walletAddress).toBe("0xNEW");
  });

  it("falls back to sub when walletAddress missing (backwards compat)", async () => {
    const payload = {
      sub: "0xFALLBACK",
      agentId: "agent-1",
    };
    mockJwtVerify.mockResolvedValue({ payload });

    const result = await verifyJwt("legacy-token");

    // The function returns the payload as-is; the wallet check used `sub` as fallback
    expect(result).toEqual(payload);
  });
});

describe("walletMatchesJwt", () => {
  it("returns true when addresses match (case insensitive)", () => {
    const jwtPayload = {
      sub: "0xabc",
      walletAddress: "0xABC",
      agentId: "agent-1",
    } as DaoDeGenJwtPayload;

    // getAddress mock lowercases both, so "0xABC" and "0xabc" both become "0xabc"
    expect(walletMatchesJwt(jwtPayload, "0xabc")).toBe(true);
  });

  it("returns false when addresses don't match", () => {
    const jwtPayload = {
      sub: "0xabc",
      walletAddress: "0xABC",
      agentId: "agent-1",
    } as DaoDeGenJwtPayload;

    expect(walletMatchesJwt(jwtPayload, "0xDEF")).toBe(false);
  });

  it("returns false on invalid address (getAddress throws)", () => {
    const jwtPayload = {
      sub: "0xabc",
      walletAddress: "invalid",
      agentId: "agent-1",
    } as DaoDeGenJwtPayload;

    expect(walletMatchesJwt(jwtPayload, "0xABC")).toBe(false);
  });

  it("uses sub fallback when walletAddress missing", () => {
    // Simulate a legacy payload without walletAddress
    const jwtPayload = {
      sub: "0xFALLBACK",
      agentId: "agent-1",
    } as unknown as DaoDeGenJwtPayload;

    expect(walletMatchesJwt(jwtPayload, "0xFALLBACK")).toBe(true);
  });
});
