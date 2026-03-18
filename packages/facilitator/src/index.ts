import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("FACILITATOR_PRIVATE_KEY is required");
  process.exit(1);
}

const PORT = Number(process.env.FACILITATOR_PORT) || 4402;

// Chain selection: FACILITATOR_CHAIN=mainnet uses Unichain mainnet (130)
// Defaults to Unichain Sepolia (1301) for safety
const IS_MAINNET = process.env.FACILITATOR_CHAIN === "mainnet" ||
  process.env.NODE_ENV === "production";

const CHAIN_ID = IS_MAINNET ? 130 : 1301;
const CHAIN_NAME = IS_MAINNET ? "Unichain" : "Unichain Sepolia";
const DEFAULT_RPC = IS_MAINNET
  ? "https://mainnet.unichain.org"
  : "https://sepolia.unichain.org";

const RPC_URL = IS_MAINNET
  ? (process.env.UNICHAIN_RPC || DEFAULT_RPC)
  : (process.env.UNICHAIN_SEPOLIA_RPC || DEFAULT_RPC);

const NETWORK_CAIP2 = `eip155:${CHAIN_ID}`;

// ---------------------------------------------------------------------------
// Chain definition (env-driven: mainnet or Sepolia)
// ---------------------------------------------------------------------------

const activeChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  testnet: !IS_MAINNET,
});

// ---------------------------------------------------------------------------
// Viem clients -> FacilitatorEvmSigner
// ---------------------------------------------------------------------------

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  chain: activeChain,
  transport: http(RPC_URL),
  account,
});

// The spread merges publicClient (readContract, verifyTypedData, getCode,
// waitForTransactionReceipt) with walletClient (writeContract, sendTransaction).
// Cast needed because viem's strict EIP-712 types are narrower than x402's
// generic Record<string, unknown> signatures.
const signer = toFacilitatorEvmSigner({
  ...publicClient,
  ...walletClient,
  address: account.address,
} as Parameters<typeof toFacilitatorEvmSigner>[0]);

// ---------------------------------------------------------------------------
// x402 Facilitator
// ---------------------------------------------------------------------------

const facilitator = new x402Facilitator();

registerExactEvmScheme(facilitator, {
  signer,
  networks: NETWORK_CAIP2,
});

console.log(
  `Facilitator wallet: ${account.address}`,
);
console.log(`Supported:`, JSON.stringify(facilitator.getSupported(), null, 2));

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== 'production';

if (!isDev && !process.env.FRONTEND_ORIGIN) {
  console.error(
    "FATAL: FRONTEND_ORIGIN must be set in production (e.g. https://daodegen.xyz). " +
    "Without it, CORS will reject every cross-origin request.",
  );
  process.exit(1);
}

const ALLOWED_ORIGINS = new Set([
  ...(isDev ? ["http://localhost:3033", "http://localhost:3031"] : []),
  process.env.FRONTEND_ORIGIN,
].filter(Boolean));

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-request-id");
}

function getTraceId(req: IncomingMessage): string {
  return (req.headers["x-request-id"] as string) || randomUUID();
}

function json(req: IncomingMessage, res: ServerResponse, status: number, body: unknown, traceId?: string) {
  cors(req, res);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  if (traceId) headers["x-request-id"] = traceId;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const MAX_BODY_SIZE = 50 * 1024;

async function readRequestBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    json(req, res, 413, { error: "Request body too large" });
    return null;
  }
  return readBody(req);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
redis.on("error", (err) => console.error("[redis]", err));

// ---------------------------------------------------------------------------
// Rate limiter (Redis — survives restarts, works across instances)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_S = 60;
const RATE_LIMIT_MAX = 60; // 60 req per 60s window per IP

async function isRateLimited(ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_S);
  }
  return count > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const method = req.method?.toUpperCase();
  const url = req.url;
  const ip = req.socket.remoteAddress || "unknown";
  const traceId = getTraceId(req);

  if (await isRateLimited(ip)) {
    json(req, res, 429, { error: "Too many requests" }, traceId);
    return;
  }

  // CORS preflight
  if (method === "OPTIONS") {
    cors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(JSON.stringify({ traceId, method, url, ts: new Date().toISOString() }));

  try {
    // GET /supported
    if (method === "GET" && url === "/supported") {
      const supported = facilitator.getSupported();
      json(req, res, 200, supported, traceId);
      return;
    }

    // POST /verify
    if (method === "POST" && url === "/verify") {
      const raw = await readRequestBody(req, res);
      if (raw === null) return;
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        json(req, res, 400, { error: "Invalid JSON" }, traceId);
        return;
      }
      const { paymentPayload, paymentRequirements } = body as Record<string, unknown>;

      if (!paymentPayload || !paymentRequirements) {
        json(req, res, 400, { error: "paymentPayload and paymentRequirements are required" }, traceId);
        return;
      }

      const result = await facilitator.verify(paymentPayload, paymentRequirements);
      console.log(JSON.stringify({ traceId, route: "verify", result: (result as Record<string, unknown>)?.isValid ?? null }));
      json(req, res, 200, result, traceId);
      return;
    }

    // POST /settle
    if (method === "POST" && url === "/settle") {
      const raw = await readRequestBody(req, res);
      if (raw === null) return;
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        json(req, res, 400, { error: "Invalid JSON" }, traceId);
        return;
      }
      const { paymentPayload, paymentRequirements } = body as Record<string, unknown>;

      if (!paymentPayload || !paymentRequirements) {
        json(req, res, 400, { error: "paymentPayload and paymentRequirements are required" }, traceId);
        return;
      }

      const result = await facilitator.settle(paymentPayload, paymentRequirements);
      console.log(JSON.stringify({ traceId, route: "settle", success: (result as Record<string, unknown>)?.success ?? null }));
      json(req, res, 200, result, traceId);
      return;
    }

    // Health check
    if (method === "GET" && (url === "/" || url === "/health")) {
      json(req, res, 200, { status: "ok", network: NETWORK_CAIP2, chain: CHAIN_NAME }, traceId);
      return;
    }

    json(req, res, 404, { error: "Not found" }, traceId);
  } catch (err) {
    console.error(JSON.stringify({ traceId, method, url, error: err instanceof Error ? err.message : String(err) }));
    if (err instanceof Error && err.message === "Request body too large") {
      json(req, res, 413, { error: "Request body too large" }, traceId);
    } else {
      json(req, res, 500, { error: "Internal server error" }, traceId);
    }
  }
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = createServer(handleRequest);
server.setTimeout(120_000); // 120s for blockchain settlement

server.listen(PORT, () => {
  console.log(`x402 Facilitator running on http://localhost:${PORT}`);
  console.log(`  GET  /supported`);
  console.log(`  POST /verify`);
  console.log(`  POST /settle`);
  console.log(`  GET  /health`);
});

function shutdown() {
  console.log("Shutting down gracefully...");
  server.close(() => {
    redis.quit().then(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  });
  // Force exit after 10s if connections don't drain
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
