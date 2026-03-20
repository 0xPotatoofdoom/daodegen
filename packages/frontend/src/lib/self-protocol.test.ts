import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available when hoisted vi.mock factories run
const { mockVerify, mockRedisExists, mockRedisSet } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockRedisExists: vi.fn(),
  mockRedisSet: vi.fn(),
}));

// Mock @selfxyz/core
vi.mock("@selfxyz/core", () => {
  class MockSelfBackendVerifier {
    verify = mockVerify;
  }
  return {
    SelfBackendVerifier: MockSelfBackendVerifier,
    DefaultConfigStore: vi.fn(),
    AllIds: ["id1", "id2"],
  };
});

// Mock logger
vi.mock("./logger", () => ({
  reqLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Redis
vi.mock("./stores/redis", () => ({
  getRedis: () => ({
    exists: mockRedisExists,
    set: mockRedisSet,
  }),
}));

// Mock crypto.randomUUID for deterministic config tests
vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

import {
  verifySelfProof,
  buildSelfAppConfig,
  getSelfUniversalLink,
  isNullifierUsed,
  markNullifierUsed,
  SELF_SCOPE,
} from "./self-protocol";

const validPayload = {
  attestationId: "id1" as never,
  proof: {
    a: ["0x1", "0x2"] as [string, string],
    b: [
      ["0x3", "0x4"],
      ["0x5", "0x6"],
    ] as [[string, string], [string, string]],
    c: ["0x7", "0x8"] as [string, string],
  },
  publicSignals: ["sig1", "sig2"],
};

describe("self-protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- SELF_SCOPE ----

  it("SELF_SCOPE equals 'daodegen-anonymous-prayer'", () => {
    expect(SELF_SCOPE).toBe("daodegen-anonymous-prayer");
  });

  // ---- verifySelfProof ----

  describe("verifySelfProof", () => {
    it("returns verified:true with nullifier on valid proof", async () => {
      mockVerify.mockResolvedValueOnce({
        isValidDetails: { isValid: true },
        discloseOutput: { nullifier: "test-nullifier-123" },
      });

      const result = await verifySelfProof(validPayload);

      expect(result).toEqual({
        verified: true,
        nullifier: "test-nullifier-123",
      });
      expect(mockVerify).toHaveBeenCalledOnce();
    });

    it("returns verified:false when proof is invalid", async () => {
      mockVerify.mockResolvedValueOnce({
        isValidDetails: { isValid: false },
      });

      const result = await verifySelfProof(validPayload);

      expect(result).toEqual({
        verified: false,
        nullifier: null,
        error: "ZK proof verification failed",
      });
    });

    it("returns verified:false with error message on exception", async () => {
      mockVerify.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await verifySelfProof(validPayload);

      expect(result).toEqual({
        verified: false,
        nullifier: null,
        error: "Network timeout",
      });
    });
  });

  // ---- buildSelfAppConfig ----

  describe("buildSelfAppConfig", () => {
    it("returns correct structure with sessionId, scope, endpoint", () => {
      const config = buildSelfAppConfig("0xabc123");

      expect(config).toMatchObject({
        sessionId: "test-uuid-1234",
        scope: "daodegen-anonymous-prayer",
        endpoint: expect.any(String),
        version: 2,
        appName: "Dao DeGen Temple",
        endpointType: "staging_https",
        userIdType: "hex",
      });
    });

    it("strips 0x prefix from userId", () => {
      const config = buildSelfAppConfig("0xdeadbeef");
      expect(config.userId).toBe("deadbeef");
    });

    it("handles userId without 0x prefix", () => {
      const config = buildSelfAppConfig("deadbeef");
      expect(config.userId).toBe("deadbeef");
    });
  });

  // ---- getSelfUniversalLink ----

  describe("getSelfUniversalLink", () => {
    it("returns URL with encoded config", () => {
      const link = getSelfUniversalLink("0xabc");
      const url = new URL(link);
      const selfAppParam = url.searchParams.get("selfApp");

      expect(selfAppParam).toBeTruthy();
      const parsed = JSON.parse(selfAppParam!);
      expect(parsed.scope).toBe("daodegen-anonymous-prayer");
      expect(parsed.userId).toBe("abc");
    });

    it("URL starts with redirect base URL", () => {
      const link = getSelfUniversalLink("0xabc");
      expect(link.startsWith("https://redirect.self.xyz")).toBe(true);
    });
  });

  // ---- isNullifierUsed ----

  describe("isNullifierUsed", () => {
    it("returns true when exists returns 1", async () => {
      mockRedisExists.mockResolvedValueOnce(1);

      const result = await isNullifierUsed("nonce-abc");

      expect(result).toBe(true);
      expect(mockRedisExists).toHaveBeenCalledWith("nullifier:nonce-abc");
    });

    it("returns false when exists returns 0", async () => {
      mockRedisExists.mockResolvedValueOnce(0);

      const result = await isNullifierUsed("nonce-xyz");

      expect(result).toBe(false);
      expect(mockRedisExists).toHaveBeenCalledWith("nullifier:nonce-xyz");
    });
  });

  // ---- markNullifierUsed ----

  describe("markNullifierUsed", () => {
    it("calls redis.set with NX flag", async () => {
      mockRedisSet.mockResolvedValueOnce("OK");

      await markNullifierUsed("nonce-123");

      expect(mockRedisSet).toHaveBeenCalledWith(
        "nullifier:nonce-123",
        "1",
        "NX"
      );
    });
  });
});
