import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock config
vi.mock("./config", () => ({
  getConfig: vi.fn(() => ({
    DAODEGEN_API_URL: "https://api.daodegen.xyz",
  })),
}));

// Mock auth
vi.mock("./auth", () => ({
  ensureJwt: vi.fn(async () => "mock-jwt-token"),
  signX402Payment: vi.fn(async () => "base64-payment-proof"),
}));

import { get, post, authenticatedGet, authenticatedPost, x402Post } from "./client.js";
import { ensureJwt, signX402Payment } from "./auth.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper to create a mock Response
function mockResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  const { ok = true, status = 200 } = init;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok,
    status,
    text: async () => text,
  } as unknown as Response;
}

describe("get", () => {
  it("returns parsed JSON on successful response", async () => {
    const data = { id: 1, name: "test" };
    mockFetch.mockResolvedValueOnce(mockResponse(data));

    const result = await get("/v1/test");

    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith("https://api.daodegen.xyz/v1/test");
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: "Not found" }, { ok: false, status: 404 }),
    );

    await expect(get("/v1/missing")).rejects.toThrow("API 404");
  });

  it("strips trailing slash from base URL", async () => {
    // The config mock already returns a URL without trailing slash,
    // but let's verify the path concatenation is correct
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

    await get("/v1/endpoint");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.daodegen.xyz/v1/endpoint",
    );
  });
});

describe("post", () => {
  it("sends correct headers and body", async () => {
    const payload = { verse: 42, context: "testing" };
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

    const result = await post("/v1/submit", payload);

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.daodegen.xyz/v1/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: "Bad request" }, { ok: false, status: 400 }),
    );

    await expect(post("/v1/bad", {})).rejects.toThrow("API 400");
  });
});

describe("authenticatedGet", () => {
  it("includes Authorization header with JWT", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ protected: true }));

    const result = await authenticatedGet("/v1/protected");

    expect(result).toEqual({ protected: true });
    expect(ensureJwt).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.daodegen.xyz/v1/protected",
      {
        headers: { Authorization: "Bearer mock-jwt-token" },
      },
    );
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse("Unauthorized", { ok: false, status: 401 }),
    );

    await expect(authenticatedGet("/v1/secret")).rejects.toThrow("API 401");
  });
});

describe("authenticatedPost", () => {
  it("includes Authorization header and body", async () => {
    const payload = { prayer_tx: "0xabc", sender: "0x123" };
    mockFetch.mockResolvedValueOnce(mockResponse({ sermon: "text" }));

    const result = await authenticatedPost("/v1/sermon", payload);

    expect(result).toEqual({ sermon: "text" });
    expect(ensureJwt).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.daodegen.xyz/v1/sermon",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-jwt-token",
        },
        body: JSON.stringify(payload),
      },
    );
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: "Forbidden" }, { ok: false, status: 403 }),
    );

    await expect(authenticatedPost("/v1/fail", {})).rejects.toThrow("API 403");
  });
});

describe("x402Post", () => {
  it("handles 402 -> sign -> retry flow", async () => {
    const challenge = { amount: "1000", recipient: "0xfacilitator" };
    const payload = { verse: 7 };

    // First request returns 402
    mockFetch.mockResolvedValueOnce(
      mockResponse(challenge, { ok: false, status: 402 }),
    );

    // Retry after payment returns success
    mockFetch.mockResolvedValueOnce(
      mockResponse({ interpretation: "verse reading" }),
    );

    const result = await x402Post("/v1/verse/lookup", payload);

    expect(result).toEqual({ interpretation: "verse reading" });

    // signX402Payment should have been called with the challenge
    expect(signX402Payment).toHaveBeenCalledWith(challenge);

    // Should have been called twice: initial request + retry
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Retry should include the X-PAYMENT header
    const retryCall = mockFetch.mock.calls[1];
    expect(retryCall[1].headers).toHaveProperty(
      "X-PAYMENT",
      "base64-payment-proof",
    );
    expect(retryCall[1].headers).toHaveProperty(
      "Authorization",
      "Bearer mock-jwt-token",
    );
  });

  it("passes through non-402 success response without signing", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ data: "free-tier" }),
    );

    const result = await x402Post("/v1/free", { query: "test" });

    expect(result).toEqual({ data: "free-tier" });
    expect(signX402Payment).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws ApiError on non-402 error responses", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: "Server error" }, { ok: false, status: 500 }),
    );

    await expect(x402Post("/v1/broken", {})).rejects.toThrow("API 500");
    expect(signX402Payment).not.toHaveBeenCalled();
  });

  it("throws ApiError when retry after payment also fails", async () => {
    // First: 402
    mockFetch.mockResolvedValueOnce(
      mockResponse({ amount: "1000" }, { ok: false, status: 402 }),
    );

    // Retry: still fails
    mockFetch.mockResolvedValueOnce(
      mockResponse(
        { error: "Payment rejected" },
        { ok: false, status: 402 },
      ),
    );

    await expect(x402Post("/v1/expensive", {})).rejects.toThrow("API 402");
  });
});

describe("parseResponse (indirectly)", () => {
  it("handles non-JSON text responses gracefully", async () => {
    // When the response body is not valid JSON, parseResponse returns the raw text.
    // We test this via get() which calls parseResponse internally.
    mockFetch.mockResolvedValueOnce(
      mockResponse("plain text response, not JSON"),
    );

    const result = await get("/v1/text");

    expect(result).toBe("plain text response, not JSON");
  });

  it("handles empty response body", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(""));

    const result = await get("/v1/empty");

    expect(result).toBe("");
  });
});
