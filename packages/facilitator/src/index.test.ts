/**
 * Comprehensive tests for the x402 facilitator HTTP server.
 *
 * The server boots as a side-effect of importing `./index.ts`, so every
 * external dependency -- including `node:http` itself -- is mocked BEFORE the
 * dynamic import.  The captured `handleRequest` callback is then exercised
 * directly, eliminating the need for a real listening socket.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// 1. Stubs for everything the module imports at the top level
// ---------------------------------------------------------------------------

const mockGetSupported = vi.fn().mockReturnValue([
  { scheme: "exact", network: "eip155:1301", asset: "USDC" },
]);
const mockVerify = vi.fn().mockResolvedValue({ valid: true });
const mockSettle = vi.fn().mockResolvedValue({ txHash: "0xabc123" });

const mockServerInstance = {
  listen: vi.fn((_port: number, cb?: () => void) => cb?.()),
  close: vi.fn((cb?: () => void) => cb?.()),
  setTimeout: vi.fn(),
};

/** We will capture the request handler passed to `createServer`. */
let capturedHandler: (req: IncomingMessage, res: ServerResponse) => void;

// Mock node:http -- intercepts createServer and saves the request handler
vi.mock("node:http", () => ({
  createServer: vi.fn((handler: (req: IncomingMessage, res: ServerResponse) => void) => {
    capturedHandler = handler;
    return mockServerInstance;
  }),
}));

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => ({ readContract: vi.fn() })),
  createWalletClient: vi.fn(() => ({ writeContract: vi.fn() })),
  defineChain: vi.fn((def: unknown) => def),
  http: vi.fn(() => "mock-transport"),
}));

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: "0xFACE",
  })),
}));

vi.mock("@x402/core/facilitator", () => {
  const Ctor = function (this: any) {
    this.getSupported = mockGetSupported;
    this.verify = mockVerify;
    this.settle = mockSettle;
  } as any;
  return { x402Facilitator: Ctor };
});

vi.mock("@x402/evm/exact/facilitator", () => ({
  registerExactEvmScheme: vi.fn(),
}));

vi.mock("@x402/evm", () => ({
  toFacilitatorEvmSigner: vi.fn(() => "mock-signer"),
}));

// ---------------------------------------------------------------------------
// 2. Dynamically import the module under test (side-effects run once)
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // The module reads this synchronously at the top level
  process.env.FACILITATOR_PRIVATE_KEY =
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  // Ensure we're in dev mode so localhost origins are included
  delete process.env.NODE_ENV;

  // Suppress noisy console output from the server boot-up
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  await import("./index.js");
});

// ---------------------------------------------------------------------------
// 3. Test helpers -- fake request / response objects
// ---------------------------------------------------------------------------

/** Minimal mock of IncomingMessage. */
function createMockReq(overrides: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  remoteAddress?: string;
}): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage & EventEmitter;
  (emitter as any).method = overrides.method ?? "GET";
  (emitter as any).url = overrides.url ?? "/";
  (emitter as any).headers = overrides.headers ?? {};
  (emitter as any).socket = { remoteAddress: overrides.remoteAddress ?? "127.0.0.1" };
  (emitter as any).destroy = vi.fn();

  // Simulate the body arriving asynchronously
  const body = overrides.body;
  if (body !== undefined) {
    queueMicrotask(() => {
      emitter.emit("data", Buffer.from(body));
      emitter.emit("end");
    });
  } else {
    queueMicrotask(() => emitter.emit("end"));
  }

  return emitter as unknown as IncomingMessage;
}

/** Minimal mock of ServerResponse that collects status, headers, and body. */
function createMockRes() {
  const _headers: Record<string, string> = {};
  let _status = 200;
  let _body = "";
  let _ended = false;

  const res = {
    setHeader: vi.fn((k: string, v: string) => {
      _headers[k] = v;
    }),
    writeHead: vi.fn((status: number, headers?: Record<string, string>) => {
      _status = status;
      if (headers) Object.assign(_headers, headers);
    }),
    end: vi.fn((data?: string) => {
      if (data) _body = data;
      _ended = true;
    }),
    // Expose collected state for assertions
    get statusCode() {
      return _status;
    },
    get headers() {
      return { ..._headers };
    },
    get body() {
      return _body;
    },
    get ended() {
      return _ended;
    },
    parsedBody() {
      return _body ? JSON.parse(_body) : undefined;
    },
  };
  return res as unknown as ServerResponse & typeof res;
}

/** Fire a synthetic request through the captured handler and return the response. */
async function simulateRequest(opts: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  remoteAddress?: string;
}) {
  const req = createMockReq(opts);
  const res = createMockRes();
  await capturedHandler(req, res as unknown as ServerResponse);
  // Give the microtask queue a chance to flush (body events are queued)
  await new Promise((r) => setTimeout(r, 10));
  return res;
}

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------

describe("facilitator HTTP server", () => {
  // Reset facilitator mock call counts between tests, but keep the handler.
  beforeEach(() => {
    mockGetSupported.mockClear();
    mockVerify.mockClear();
    mockSettle.mockClear();
  });

  // -----------------------------------------------------------------------
  // Module-level wiring
  // -----------------------------------------------------------------------

  describe("module initialisation", () => {
    it("captures the request handler via createServer", () => {
      expect(capturedHandler).toBeDefined();
      expect(typeof capturedHandler).toBe("function");
    });

    it("calls server.listen on the configured port", () => {
      expect(mockServerInstance.listen).toHaveBeenCalled();
    });

    it("sets a 120 s socket timeout", () => {
      expect(mockServerInstance.setTimeout).toHaveBeenCalledWith(120_000);
    });
  });

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  describe("GET / (health)", () => {
    it("returns 200 with status ok and correct network", async () => {
      const res = await simulateRequest({ method: "GET", url: "/" });
      expect(res.statusCode).toBe(200);
      expect(res.parsedBody()).toEqual({ status: "ok", network: "eip155:1301" });
    });
  });

  describe("GET /health", () => {
    it("returns 200 with status ok and correct network", async () => {
      const res = await simulateRequest({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      expect(res.parsedBody()).toEqual({ status: "ok", network: "eip155:1301" });
    });
  });

  // -----------------------------------------------------------------------
  // GET /supported
  // -----------------------------------------------------------------------

  describe("GET /supported", () => {
    it("returns the facilitator supported list", async () => {
      const res = await simulateRequest({ method: "GET", url: "/supported" });
      expect(res.statusCode).toBe(200);
      expect(mockGetSupported).toHaveBeenCalledOnce();
      expect(res.parsedBody()).toEqual([
        { scheme: "exact", network: "eip155:1301", asset: "USDC" },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // POST /verify
  // -----------------------------------------------------------------------

  describe("POST /verify", () => {
    it("returns 200 with verification result on valid payload", async () => {
      const payload = {
        paymentPayload: { amount: "100" },
        paymentRequirements: { asset: "USDC" },
      };
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(200);
      expect(mockVerify).toHaveBeenCalledWith(
        payload.paymentPayload,
        payload.paymentRequirements,
      );
      expect(res.parsedBody()).toEqual({ valid: true });
    });

    it("returns 400 when paymentPayload is missing", async () => {
      const payload = { paymentRequirements: { asset: "USDC" } };
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(400);
      expect(res.parsedBody()).toEqual({
        error: "paymentPayload and paymentRequirements are required",
      });
    });

    it("returns 400 when paymentRequirements is missing", async () => {
      const payload = { paymentPayload: { amount: "100" } };
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(400);
      expect(res.parsedBody()).toEqual({
        error: "paymentPayload and paymentRequirements are required",
      });
    });

    it("returns 400 on malformed JSON", async () => {
      const badJson = "{ not valid json !!!";
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(badJson.length) },
        body: badJson,
      });
      expect(res.statusCode).toBe(400);
      expect(res.parsedBody()).toEqual({ error: "Invalid JSON" });
    });

    it("returns 500 when facilitator.verify rejects", async () => {
      mockVerify.mockRejectedValueOnce(new Error("chain down"));
      const payload = {
        paymentPayload: { amount: "100" },
        paymentRequirements: { asset: "USDC" },
      };
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(500);
      expect(res.parsedBody()).toEqual({ error: "Internal server error" });
    });
  });

  // -----------------------------------------------------------------------
  // POST /settle
  // -----------------------------------------------------------------------

  describe("POST /settle", () => {
    it("returns 200 with settlement result on valid payload", async () => {
      const payload = {
        paymentPayload: { amount: "100" },
        paymentRequirements: { asset: "USDC" },
      };
      const res = await simulateRequest({
        method: "POST",
        url: "/settle",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(200);
      expect(mockSettle).toHaveBeenCalledWith(
        payload.paymentPayload,
        payload.paymentRequirements,
      );
      expect(res.parsedBody()).toEqual({ txHash: "0xabc123" });
    });

    it("returns 400 when both fields are missing", async () => {
      const payload = {};
      const res = await simulateRequest({
        method: "POST",
        url: "/settle",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(400);
      expect(res.parsedBody()).toEqual({
        error: "paymentPayload and paymentRequirements are required",
      });
    });

    it("returns 500 when facilitator.settle rejects", async () => {
      mockSettle.mockRejectedValueOnce(new Error("nonce too low"));
      const payload = {
        paymentPayload: { amount: "100" },
        paymentRequirements: { asset: "USDC" },
      };
      const res = await simulateRequest({
        method: "POST",
        url: "/settle",
        headers: { "content-length": String(JSON.stringify(payload).length) },
        body: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(500);
      expect(res.parsedBody()).toEqual({ error: "Internal server error" });
    });
  });

  // -----------------------------------------------------------------------
  // OPTIONS (CORS preflight)
  // -----------------------------------------------------------------------

  describe("OPTIONS (CORS preflight)", () => {
    it("returns 204 with CORS headers for allowed origin", async () => {
      const res = await simulateRequest({
        method: "OPTIONS",
        url: "/verify",
        headers: { origin: "http://localhost:3033" },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3033",
      );
      expect(res.headers["Access-Control-Allow-Methods"]).toBe(
        "GET, POST, OPTIONS",
      );
      expect(res.headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
    });

    it("returns 204 without Allow-Origin for disallowed origin", async () => {
      const res = await simulateRequest({
        method: "OPTIONS",
        url: "/verify",
        headers: { origin: "https://evil.example.com" },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 404 for unknown routes
  // -----------------------------------------------------------------------

  describe("unknown routes", () => {
    it("returns 404 for GET to unknown path", async () => {
      const res = await simulateRequest({ method: "GET", url: "/unknown" });
      expect(res.statusCode).toBe(404);
      expect(res.parsedBody()).toEqual({ error: "Not found" });
    });

    it("returns 404 for POST to unknown path", async () => {
      const res = await simulateRequest({
        method: "POST",
        url: "/nope",
        headers: { "content-length": "2" },
        body: "{}",
      });
      expect(res.statusCode).toBe(404);
      expect(res.parsedBody()).toEqual({ error: "Not found" });
    });

    it("returns 404 for DELETE method", async () => {
      const res = await simulateRequest({
        method: "DELETE",
        url: "/supported",
      });
      expect(res.statusCode).toBe(404);
      expect(res.parsedBody()).toEqual({ error: "Not found" });
    });

    it("returns 404 for PUT method on valid route", async () => {
      const res = await simulateRequest({
        method: "PUT",
        url: "/verify",
        headers: { "content-length": "2" },
        body: "{}",
      });
      expect(res.statusCode).toBe(404);
      expect(res.parsedBody()).toEqual({ error: "Not found" });
    });
  });

  // -----------------------------------------------------------------------
  // CORS headers on regular responses
  // -----------------------------------------------------------------------

  describe("CORS on regular responses", () => {
    it("sets Access-Control-Allow-Origin for allowed origin", async () => {
      const res = await simulateRequest({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:3031" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3031",
      );
    });

    it("does NOT set Access-Control-Allow-Origin for disallowed origin", async () => {
      const res = await simulateRequest({
        method: "GET",
        url: "/health",
        headers: { origin: "https://attacker.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("always sets Access-Control-Allow-Methods and Allow-Headers", async () => {
      const res = await simulateRequest({
        method: "GET",
        url: "/supported",
        headers: { origin: "https://nowhere.example" },
      });
      expect(res.headers["Access-Control-Allow-Methods"]).toBe(
        "GET, POST, OPTIONS",
      );
      expect(res.headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
    });
  });

  // -----------------------------------------------------------------------
  // Security headers
  // -----------------------------------------------------------------------

  describe("security headers", () => {
    it("includes X-Content-Type-Options: nosniff", async () => {
      const res = await simulateRequest({ method: "GET", url: "/health" });
      expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    });

    it("includes X-Frame-Options: DENY", async () => {
      const res = await simulateRequest({ method: "GET", url: "/health" });
      expect(res.headers["X-Frame-Options"]).toBe("DENY");
    });

    it("includes Content-Type: application/json", async () => {
      const res = await simulateRequest({ method: "GET", url: "/supported" });
      expect(res.headers["Content-Type"]).toBe("application/json");
    });
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  describe("rate limiting", () => {
    // Use a unique IP per test to avoid cross-test contamination
    const uniqueIp = () =>
      `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    it("allows up to 60 requests from the same IP", async () => {
      const ip = uniqueIp();
      let lastRes: Awaited<ReturnType<typeof simulateRequest>> | undefined;
      for (let i = 0; i < 60; i++) {
        lastRes = await simulateRequest({
          method: "GET",
          url: "/health",
          remoteAddress: ip,
        });
      }
      expect(lastRes!.statusCode).toBe(200);
    });

    it("returns 429 on the 61st request from the same IP", async () => {
      const ip = uniqueIp();
      for (let i = 0; i < 60; i++) {
        await simulateRequest({
          method: "GET",
          url: "/health",
          remoteAddress: ip,
        });
      }
      const res = await simulateRequest({
        method: "GET",
        url: "/health",
        remoteAddress: ip,
      });
      expect(res.statusCode).toBe(429);
      expect(res.parsedBody()).toEqual({ error: "Too many requests" });
    });

    it("does not rate-limit requests from different IPs", async () => {
      // Fire 60 from IP A, then 1 from IP B -- B should be fine
      const ipA = uniqueIp();
      const ipB = uniqueIp();
      for (let i = 0; i < 60; i++) {
        await simulateRequest({
          method: "GET",
          url: "/health",
          remoteAddress: ipA,
        });
      }
      const res = await simulateRequest({
        method: "GET",
        url: "/health",
        remoteAddress: ipB,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Body size limits
  // -----------------------------------------------------------------------

  describe("request body size limits", () => {
    it("returns 413 when Content-Length exceeds 50 KB", async () => {
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(51 * 1024) },
        body: "x", // body content does not matter; header triggers rejection
      });
      expect(res.statusCode).toBe(413);
      expect(res.parsedBody()).toEqual({ error: "Request body too large" });
    });

    it("allows exactly 50 KB Content-Length", async () => {
      // Build a valid JSON payload that is exactly at the limit
      const payload = {
        paymentPayload: { data: "a".repeat(25_000) },
        paymentRequirements: { data: "b".repeat(25_000) },
      };
      const bodyStr = JSON.stringify(payload);
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": String(50 * 1024) },
        body: bodyStr,
      });
      // It should NOT be 413 -- it will either be 200 (verify passes)
      // or some other code, but definitely not 413
      expect(res.statusCode).not.toBe(413);
    });

    it("returns 413 when streaming body exceeds 50 KB (no Content-Length header)", async () => {
      // Build an oversized body and stream it without a content-length header.
      // readBody() enforces the limit via the streaming `size` counter and will
      // destroy the request, which causes `handleRequest` to catch the error.
      const emitter = new EventEmitter() as IncomingMessage & EventEmitter;
      (emitter as any).method = "POST";
      (emitter as any).url = "/verify";
      (emitter as any).headers = {};
      (emitter as any).socket = { remoteAddress: "192.168.99.1" };
      (emitter as any).destroy = vi.fn();

      const bigChunk = Buffer.alloc(51 * 1024, 0x41); // 51 KB of "A"
      queueMicrotask(() => {
        emitter.emit("data", bigChunk);
        emitter.emit("end");
      });

      const res = createMockRes();
      await capturedHandler(emitter as unknown as IncomingMessage, res as unknown as ServerResponse);
      await new Promise((r) => setTimeout(r, 20));

      expect(res.statusCode).toBe(413);
      expect(res.parsedBody()).toEqual({ error: "Request body too large" });
    });
  });

  // -----------------------------------------------------------------------
  // JSON error handling edge cases
  // -----------------------------------------------------------------------

  describe("error handling edge cases", () => {
    it("returns 400 for completely empty POST body on /verify", async () => {
      // Empty string is not valid JSON -> JSON.parse throws
      const res = await simulateRequest({
        method: "POST",
        url: "/verify",
        headers: { "content-length": "0" },
        body: "",
      });
      expect(res.statusCode).toBe(400);
      expect(res.parsedBody()).toEqual({ error: "Invalid JSON" });
    });

    it("returns 400 for completely empty POST body on /settle", async () => {
      const res = await simulateRequest({
        method: "POST",
        url: "/settle",
        headers: { "content-length": "0" },
        body: "",
      });
      expect(res.statusCode).toBe(400);
      expect(res.parsedBody()).toEqual({ error: "Invalid JSON" });
    });
  });

  // -----------------------------------------------------------------------
  // Method / URL edge cases
  // -----------------------------------------------------------------------

  describe("method and URL edge cases", () => {
    it("POST /supported returns 404 (only GET is accepted)", async () => {
      const res = await simulateRequest({
        method: "POST",
        url: "/supported",
        headers: { "content-length": "2" },
        body: "{}",
      });
      expect(res.statusCode).toBe(404);
    });

    it("GET /verify returns 404 (only POST is accepted)", async () => {
      const res = await simulateRequest({ method: "GET", url: "/verify" });
      expect(res.statusCode).toBe(404);
    });

    it("GET /settle returns 404 (only POST is accepted)", async () => {
      const res = await simulateRequest({ method: "GET", url: "/settle" });
      expect(res.statusCode).toBe(404);
    });
  });
});
