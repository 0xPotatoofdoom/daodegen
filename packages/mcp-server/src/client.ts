import { getConfig } from "./config.js";
import { ensureJwt } from "./auth.js";

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}: ${JSON.stringify(body)}`);
    this.name = "ApiError";
  }
}

function url(path: string): string {
  const base = getConfig().DAODEGEN_API_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function get(path: string): Promise<unknown> {
  const res = await fetch(url(path));
  const body = await parseResponse(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export async function post(path: string, data: unknown): Promise<unknown> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await parseResponse(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export async function authenticatedGet(path: string): Promise<unknown> {
  const jwt = await ensureJwt();
  const res = await fetch(url(path), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const body = await parseResponse(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export async function authenticatedPost(
  path: string,
  data: unknown,
): Promise<unknown> {
  const jwt = await ensureJwt();
  const res = await fetch(url(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(data),
  });
  const body = await parseResponse(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/**
 * POST with JWT auth that handles 402 payment challenges.
 *
 * Flow: POST -> if 402 -> extract payment header -> sign payment -> retry with proof.
 *
 * This is a simplified x402 client. The server returns a 402 with payment
 * requirements in the response body. We sign the payment with our private key
 * and retry with the x-402-payment header.
 */
export async function x402Post(
  path: string,
  data: unknown,
): Promise<unknown> {
  const jwt = await ensureJwt();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
  };

  const res = await fetch(url(path), {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (res.status !== 402) {
    const body = await parseResponse(res);
    if (!res.ok) throw new ApiError(res.status, body);
    return body;
  }

  // 402 Payment Required -- extract challenge and sign
  const { signX402Payment } = await import("./auth.js");
  const challengeBody = await parseResponse(res) as Record<string, unknown>;

  const paymentHeader = await signX402Payment(challengeBody);

  const retryRes = await fetch(url(path), {
    method: "POST",
    headers: {
      ...headers,
      "X-PAYMENT": paymentHeader,
    },
    body: JSON.stringify(data),
  });

  const retryBody = await parseResponse(retryRes);
  if (!retryRes.ok) throw new ApiError(retryRes.status, retryBody);
  return retryBody;
}
