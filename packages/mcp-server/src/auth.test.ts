import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock viem before any imports
const mockSignMessage = vi.fn();
const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";
const mockHasPrivateKey = vi.fn(() => true);
const mockGetChain = vi.fn(() => ({ id: 1301, name: "Unichain Sepolia" }));

vi.mock("viem", () => ({
  createWalletClient: vi.fn(() => ({
    signMessage: mockSignMessage,
  })),
  http: vi.fn(),
}));

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: mockAddress,
  })),
}));

// Mock config module -- use outer-scope mocks so we can control per-test
vi.mock("./config", () => ({
  getConfig: vi.fn(() => ({
    DAODEGEN_API_URL: "https://api.daodegen.xyz",
    DAODEGEN_PRIVATE_KEY:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    ACTIVE_CHAIN: "sepolia",
    DAODEGEN_RPC_URL: "https://sepolia.unichain.org",
  })),
  hasPrivateKey: mockHasPrivateKey,
  getChain: mockGetChain,
}));

const mockFetch = vi.fn();

beforeEach(() => {
  // resetModules clears module cache so each dynamic import gets fresh
  // module-level state (cachedJwt, jwtExpiresAt, _account, _walletClient)
  vi.resetModules();
  vi.clearAllMocks();
  mockHasPrivateKey.mockReturnValue(true);
  mockGetChain.mockReturnValue({ id: 1301, name: "Unichain Sepolia" });
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureJwt", () => {
  it("performs full SIWE auth flow: nonce -> sign -> verify -> JWT", async () => {
    const { ensureJwt } = await import("./auth.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: "test-nonce-123" }),
    });
    mockSignMessage.mockResolvedValueOnce("0xsignature123");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-token-abc" }),
    });

    const token = await ensureJwt();

    expect(token).toBe("jwt-token-abc");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://api.daodegen.xyz/api/auth/nonce",
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.daodegen.xyz/api/auth/verify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(mockSignMessage).toHaveBeenCalledOnce();
    const signCall = mockSignMessage.mock.calls[0][0];
    expect(signCall.message).toContain("Sign in to Dao DeGen Temple");
    expect(signCall.message).toContain("Nonce: test-nonce-123");
    expect(signCall.message).toContain("Chain ID: 1301");
    expect(signCall.message).toContain(mockAddress);
  });

  it("uses chain ID from getChain() in SIWE message", async () => {
    mockGetChain.mockReturnValue({ id: 130, name: "Unichain" });
    const { ensureJwt } = await import("./auth.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: "nonce-mainnet" }),
    });
    mockSignMessage.mockResolvedValueOnce("0xsig");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-mainnet" }),
    });

    await ensureJwt();

    const signCall = mockSignMessage.mock.calls[0][0];
    expect(signCall.message).toContain("Chain ID: 130");
  });

  it("returns cached JWT within expiry window", async () => {
    const { ensureJwt } = await import("./auth.js");

    // First call: full flow
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: "nonce-1" }),
    });
    mockSignMessage.mockResolvedValueOnce("0xsig1");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "cached-jwt" }),
    });

    const first = await ensureJwt();
    expect(first).toBe("cached-jwt");

    // Second call: should return cached without any fetch
    mockFetch.mockClear();
    const second = await ensureJwt();
    expect(second).toBe("cached-jwt");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when no private key is configured", async () => {
    mockHasPrivateKey.mockReturnValue(false);
    const { ensureJwt } = await import("./auth.js");

    await expect(ensureJwt()).rejects.toThrow(
      "Set DAODEGEN_PRIVATE_KEY to enable authenticated tools",
    );
  });

  it("throws on nonce fetch failure", async () => {
    const { ensureJwt } = await import("./auth.js");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(ensureJwt()).rejects.toThrow("Failed to get nonce: HTTP 500");
  });

  it("throws on verify failure", async () => {
    const { ensureJwt } = await import("./auth.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: "nonce-verify-fail" }),
    });
    mockSignMessage.mockResolvedValueOnce("0xsig");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Invalid signature",
    });

    await expect(ensureJwt()).rejects.toThrow(
      "SIWE verify failed: HTTP 401 - Invalid signature",
    );
  });
});

describe("signX402Payment", () => {
  it("produces valid base64 encoded proof with signature", async () => {
    const { signX402Payment } = await import("./auth.js");

    const challenge = {
      amount: "1000",
      currency: "USDC",
      recipient: "0xrecipient",
    };

    mockSignMessage.mockResolvedValueOnce("0xpayment-signature");

    const result = await signX402Payment(challenge);
    const decoded = JSON.parse(
      Buffer.from(result, "base64").toString("utf-8"),
    );

    expect(decoded).toHaveProperty("payload");
    expect(decoded).toHaveProperty("signature", "0xpayment-signature");
    expect(decoded.payload.amount).toBe("1000");
    expect(decoded.payload.currency).toBe("USDC");
    expect(decoded.payload.recipient).toBe("0xrecipient");
    expect(decoded.payload.payer).toBe(mockAddress);
    expect(decoded.payload.timestamp).toBeTypeOf("number");
  });

  it("returns Node-safe base64 (Buffer.from, not btoa)", async () => {
    const { signX402Payment } = await import("./auth.js");

    mockSignMessage.mockResolvedValueOnce("0xsig");

    const result = await signX402Payment({ test: true });

    // Must be valid base64 decodable via Buffer
    expect(() => Buffer.from(result, "base64").toString("utf-8")).not.toThrow();
    const decoded = JSON.parse(
      Buffer.from(result, "base64").toString("utf-8"),
    );
    expect(decoded.payload.test).toBe(true);

    // Round-trip: re-encoding should produce the same string
    const reEncoded = Buffer.from(JSON.stringify(decoded)).toString("base64");
    expect(reEncoded).toBe(result);
  });

  it("signs the stringified payment payload", async () => {
    const { signX402Payment } = await import("./auth.js");

    const challenge = { test: true };
    mockSignMessage.mockResolvedValueOnce("0xsig");

    await signX402Payment(challenge);

    expect(mockSignMessage).toHaveBeenCalledOnce();
    const signCall = mockSignMessage.mock.calls[0][0];
    const parsed = JSON.parse(signCall.message);
    expect(parsed.test).toBe(true);
    expect(parsed.payer).toBe(mockAddress);
    expect(parsed.timestamp).toBeTypeOf("number");
  });
});
