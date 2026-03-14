# DaoDeGen -- Manual E2E Testing Guide

This document provides step-by-step instructions for manually testing every
API endpoint in the DaoDeGen frontend server. All commands are designed to
run against `http://localhost:3033` (the default dev port). Each section
includes the exact `curl` invocation and the expected response shape so you
can verify correct behavior without any additional tooling beyond a terminal,
`curl`, and `jq`.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Setup](#2-server-setup)
3. [Step-by-Step Manual Testing](#3-step-by-step-manual-testing)
   - 3a. [Health Check](#3a-health-check)
   - 3b. [Security Headers](#3b-security-headers)
   - 3c. [Authentication Flow (SIWE)](#3c-authentication-flow-siwe)
   - 3d. [x402 Payment Flow](#3d-x402-payment-flow)
   - 3e. [Verse Oracle Endpoints (Full E2E)](#3e-verse-oracle-endpoints-full-e2e)
   - 3f. [Error Cases](#3f-error-cases)
4. [Programmatic SIWE Message Construction](#4-programmatic-siwe-message-construction)
5. [Running Automated Tests](#5-running-automated-tests)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum Version | Check Command |
|---|---|---|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| curl | any modern version | `curl --version` |
| jq | 1.6+ | `jq --version` |
| ethers.js (optional) | 6.x | only needed for Section 4 |

You also need a terminal that supports standard POSIX shell syntax.

If you plan to execute the programmatic signing flow in Section 4 you will
need an Ethereum private key. **Never use a mainnet-funded key for testing.**
Generate a throwaway key with:

```bash
node -e "const w = require('ethers').Wallet.createRandom(); console.log('Address:', w.address); console.log('Private Key:', w.privateKey);"
```

---

## 2. Server Setup

### 2.1 Clone and install

```bash
npm install    # from repo root -- installs all workspaces
```

### 2.2 Environment variables

Copy the example env file and adjust as needed:

```bash
cp packages/frontend/.env.example packages/frontend/.env.local
```

For **local E2E testing** the minimum `.env.local` is:

```dotenv
# Skip on-chain AgentRegistry lookups -- returns agentId "dev-agent-1"
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000

# JWT signing secret (any non-empty string works in dev)
JWT_SECRET=dev-secret-key

# Development environment
NODE_ENV=development
APP_ENV=development
NEXT_PUBLIC_APP_ENV=development

# Self-hosted x402 facilitator URL
FACILITATOR_URL=http://localhost:4402

# Facilitator wallet private key (for settlement transactions)
FACILITATOR_PRIVATE_KEY=0x_your_facilitator_private_key
```

Payment verification and on-chain USDC settlement are handled by the
self-hosted facilitator (`packages/facilitator`), not by the Coinbase CDP.
The facilitator wallet needs ETH on Unichain Sepolia for gas.

### 2.3 Start both servers

You need two processes running: the x402 facilitator and the Next.js frontend.

**Terminal 1 -- facilitator:**

```bash
FACILITATOR_PRIVATE_KEY=0x_your_key npm run facilitator:dev
```

Verify it is running:

```bash
curl -s http://localhost:4402/health | jq .
curl -s http://localhost:4402/supported | jq .
```

**Terminal 2 -- frontend:**

```bash
npm run frontend:dev
```

Verify it is running:

```bash
curl -s http://localhost:3033/api/health | jq .
```

---

## 3. Step-by-Step Manual Testing

All commands below assume the shell variable `BASE` is set:

```bash
BASE=http://localhost:3033
```

### 3a. Health Check

```bash
curl -s "$BASE/api/health" | jq .
```

**Expected response** (HTTP 200):

```json
{
  "status": "ok",
  "timestamp": "2026-02-19T12:00:00.000Z",
  "version": "0.1.0"
}
```

Verify:
- `status` is exactly `"ok"`.
- `timestamp` is a valid ISO 8601 string.
- `version` matches the value in `package.json` (currently `"0.1.0"`).

---

### 3b. Security Headers

```bash
curl -sv "$BASE/api/health" 2>&1 | grep -i "< x-frame\|< x-content\|< referrer\|< content-security"
```

You can also inspect all response headers:

```bash
curl -sI "$BASE/api/health"
```

**Expected headers** (present on every `/api/*` route):

| Header | Expected Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://* wss://*;` |

The middleware is applied by `src/middleware.ts` and its matcher covers all
paths under `/api/:path*`.

---

### 3c. Authentication Flow (SIWE)

The authentication flow has three steps: obtain a nonce, construct and sign a
SIWE message, then exchange the signature for a JWT.

#### Step 1 -- Get a nonce

```bash
NONCE=$(curl -s "$BASE/api/auth/nonce" | jq -r '.nonce')
echo "Nonce: $NONCE"
```

**Expected response** (HTTP 200):

```json
{
  "nonce": "<random-alphanumeric-string>"
}
```

The nonce is valid for **5 minutes** and can only be used once.

#### Step 2 -- Construct the SIWE message

A SIWE (Sign-In With Ethereum, EIP-4361) message has a strict plaintext
format. Below is the exact template. Replace `<ADDRESS>` with your Ethereum
wallet address (checksummed) and `<NONCE>` with the value obtained above.

```
localhost wants you to sign in with your Ethereum account:
<ADDRESS>

Sign in to DaoDeGen

URI: http://localhost:3033
Version: 1
Chain ID: 1
Nonce: <NONCE>
Issued At: <ISO8601_TIMESTAMP>
```

**You must sign this exact plaintext with the private key corresponding to
`<ADDRESS>`.** See Section 4 for how to do this programmatically with
ethers.js.

#### Step 3 -- Verify the signature

```bash
curl -s -X POST "$BASE/api/auth/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "<THE_FULL_SIWE_MESSAGE_STRING>",
    "signature": "<0x_HEX_SIGNATURE>"
  }' | jq .
```

**Expected response** (HTTP 200):

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Save the token for subsequent requests:

```bash
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Error responses:**

| Scenario | HTTP Status | Body |
|---|---|---|
| Invalid or expired nonce | 401 | `{ "error": "Invalid or expired nonce" }` |
| Invalid signature | 401 | `{ "error": "Invalid signature" }` |
| Address not registered as agent (non-dev mode) | 401 | `{ "error": "Address is not a registered Agent (EIP-8004)" }` |
| Malformed JSON body | 500 | `{ "error": "<parse error message>" }` |

---

### 3d. x402 Payment Flow

The verse oracle endpoints use the x402 protocol (v2) for payment. x402
handles everything in a single HTTP request/response cycle using USDC on
Unichain Sepolia, verified and settled by the self-hosted facilitator.

**How x402 works:**

1. Client sends POST to a verse endpoint
2. Server returns 402 with `payment-required` header (base64-encoded JSON)
3. Client signs a USDC `transferWithAuthorization` (EIP-3009)
4. Client retries the request with a `PAYMENT-SIGNATURE` header
5. Facilitator verifies the signature, server runs the handler, facilitator settles on-chain

**Payment details:**

| Parameter | Value |
|---|---|
| Network | eip155:1301 (Unichain Sepolia) |
| Token | USDC at `0x31d0220469e10c4E71834a79b1f276d740d3768F` |
| Facilitator | Self-hosted at `http://localhost:4402` |
| PayTo | `0x3D0e10329c864A7422761af058f909267a776029` |
| Scheme | exact |

**Verse oracle pricing:**

| Endpoint | Price |
|---|---|
| `/v1/verse/lookup` | $0.001 |
| `/v1/verse/commentary` | $0.01 |
| `/v1/verse/oracle` | $0.10 |

#### Step 1 -- Request verse data (get 402)

```bash
curl -s -X POST "$BASE/v1/verse/lookup" \
  -H "Content-Type: application/json" \
  -d '{"verse": 1}' | jq .
```

**Expected response** (HTTP 402):

The response includes a `payment-required` header containing base64-encoded
payment requirements. Decode it:

```bash
curl -s -X POST "$BASE/v1/verse/lookup" \
  -H "Content-Type: application/json" \
  -d '{"verse": 1}' \
  -D - -o /dev/null 2>/dev/null \
  | grep -i payment-required \
  | cut -d' ' -f2 \
  | base64 -d | jq .
```

#### Step 2 -- Construct and sign payment

This step requires signing an EIP-712 typed data message for
`TransferWithAuthorization` (EIP-3009) against the USDC contract. The
Playwright E2E tests in `e2e/fixtures/x402-client.ts` demonstrate the exact
signing flow using viem.

#### Step 3 -- Retry with payment

```bash
curl -s -X POST "$BASE/v1/verse/lookup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -H "PAYMENT-SIGNATURE: <base64-encoded-payment-payload>" \
  -d '{"verse": 1}' | jq .
```

**Expected response** (HTTP 200):

```json
{
  "verse": 1,
  "title": "The Tao",
  "text": "The Tao that can be told is not the eternal Tao...",
  "interpretation": "..."
}
```

After a successful response, the facilitator submits the
`transferWithAuthorization` transaction on-chain to settle the USDC payment.

---

### 3e. Verse Oracle Endpoints (Full E2E)

All verse endpoints require both x402 payment and JWT authentication.
Payment is checked first (by the `withX402` wrapper), then JWT auth (by the
handler).

#### Without payment -- all return 402

```bash
curl -s -X POST "$BASE/v1/verse/lookup" -H "Content-Type: application/json" -d '{"verse":1}'
# -> 402

curl -s -X POST "$BASE/v1/verse/commentary" -H "Content-Type: application/json" -d '{"verse":42,"context":"liquidity"}'
# -> 402

curl -s -X POST "$BASE/v1/verse/oracle" -H "Content-Type: application/json" -d '{"state":"holding ETH"}'
# -> 402
```

#### Valid JWT without payment -- still 402

```bash
curl -s -X POST "$BASE/v1/verse/lookup" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"verse": 1}'
# -> 402 (payment check runs before JWT auth)
```

---

### 3f. Error Cases

#### 3f.1 Health -- no error cases

The health endpoint has no failure modes under normal operation.

#### 3f.2 Auth nonce -- no error cases

The nonce endpoint always succeeds with a fresh nonce.

#### 3f.3 Auth verify -- invalid body

```bash
curl -s -X POST "$BASE/api/auth/verify" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Expected:** HTTP 500 with an error message (missing `message`/`signature`).

#### 3f.4 Auth verify -- expired nonce

Request a nonce, wait more than 5 minutes, then attempt to verify. The nonce
will have expired:

**Expected:** HTTP 401 `{ "error": "Invalid or expired nonce" }`

#### 3f.5 Auth verify -- reused nonce

A nonce is burned after a single use. Using it a second time returns:

```
HTTP 401 { "error": "Invalid or expired nonce" }
```

---

## 4. Programmatic SIWE Message Construction

For bots and automated agents, you need to construct and sign the SIWE
message programmatically. Below is a complete Node.js script using
**ethers.js v6** and the **siwe** package.

### 4.1 Install dependencies

```bash
npm install ethers siwe
```

### 4.2 Full signing script

Save as `scripts/e2e-auth.mjs`:

```javascript
import { Wallet } from "ethers";
import { SiweMessage } from "siwe";

const BASE = "http://localhost:3033";

// Use a throwaway private key -- NEVER use a funded key
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  const wallet = new Wallet(PRIVATE_KEY);
  const address = wallet.address;
  console.log("Wallet address:", address);

  // Step 1: Get nonce
  const nonceRes = await fetch(`${BASE}/api/auth/nonce`);
  const { nonce } = await nonceRes.json();
  console.log("Nonce:", nonce);

  // Step 2: Construct SIWE message
  const siweMessage = new SiweMessage({
    domain: "localhost",
    address: address,
    statement: "Sign in to DaoDeGen",
    uri: BASE,
    version: "1",
    chainId: 1,
    nonce: nonce,
    issuedAt: new Date().toISOString(),
  });

  const messageString = siweMessage.prepareMessage();
  console.log("\n--- SIWE Message ---");
  console.log(messageString);
  console.log("--- End Message ---\n");

  // Step 3: Sign the message
  const signature = await wallet.signMessage(messageString);
  console.log("Signature:", signature);

  // Step 4: Verify with server
  const verifyRes = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: messageString, signature }),
  });

  const verifyData = await verifyRes.json();
  console.log("Verify response:", JSON.stringify(verifyData, null, 2));

  if (verifyData.success) {
    console.log("\nJWT obtained successfully.");
    console.log("Token:", verifyData.token);
  } else {
    console.error("\nAuthentication failed:", verifyData.error);
    process.exit(1);
  }

  return verifyData.token;
}

main().catch(console.error);
```

Run it:

```bash
node scripts/e2e-auth.mjs
```

---

## 5. Running Automated Tests

### 5.1 Unit tests (Vitest)

```bash
cd packages/frontend
npm run test
```

This runs the Vitest suite which includes tests for:
- `src/lib/auth.test.ts` -- SIWE verification logic
- `src/lib/x402.test.ts` -- x402 payment configuration
- `src/lib/env.test.ts` -- Environment variable validation
- `src/lib/contracts.test.ts` -- Contract address configuration
- `src/lib/infra.test.ts` -- Infrastructure checks
- `src/middleware.test.ts` -- Security header middleware
- `src/app/api/health/route.test.ts` -- Health endpoint
- `src/app/api/security.test.ts` -- API security tests

### 5.2 E2E tests (Playwright)

Playwright automatically starts both the facilitator and the frontend server.

**Unpaid flow (no funded wallet required):**

```bash
cd packages/frontend
FACILITATOR_PRIVATE_KEY=0x_your_key npx playwright test
```

This runs all tests that do not require a funded payer wallet: 402 response
validation, facilitator health checks, payment header structure, auth flow.

**Full paid flow (funded wallet required):**

```bash
cd packages/frontend
E2E_PAYER_PRIVATE_KEY=0x_payer_key \
FACILITATOR_PRIVATE_KEY=0x_facilitator_key \
npx playwright test
```

The payer wallet must hold USDC on Unichain Sepolia. The paid flow tests
sign real EIP-3009 `transferWithAuthorization` payloads, the facilitator
verifies and settles on-chain, and the tests assert 200 responses with
verse data. Each run consumes ~$0.111 USDC ($0.001 + $0.01 + $0.10).

Or with the interactive UI:

```bash
npx playwright test --ui
```

### 5.3 Health check script

```bash
cd packages/frontend
npm run health-check
```

This runs `scripts/health-check.js` and validates the `/api/health` endpoint.

---

## 6. Troubleshooting

### Server does not start

**Symptom:** `npm run dev` fails or port 3033 is not listening.

**Fixes:**
- Ensure no other process is using port 3033: `lsof -i :3033`
- Kill any stale Next.js processes: `kill $(lsof -t -i :3033)`
- Delete `.next` build cache and retry: `rm -rf .next && npm run dev`

### Facilitator does not start

**Symptom:** `npm run facilitator:dev` fails or port 4402 is not listening.

**Fixes:**
- Ensure `FACILITATOR_PRIVATE_KEY` is set (required)
- Check no other process is using port 4402: `lsof -i :4402`
- Verify the facilitator can reach Unichain Sepolia RPC:
  `curl -s https://sepolia.unichain.org -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"net_version","id":1}'`

### "Invalid or expired nonce"

**Cause:** The nonce was used more than 5 minutes after creation, or it was
already consumed by a previous verify call.

**Fix:** Request a fresh nonce from `/api/auth/nonce` immediately before
constructing the SIWE message. Do not reuse nonces.

### "Address is not a registered Agent (EIP-8004)"

**Cause:** The `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS` env var points to a real
contract, and the signing address is not registered.

**Fix:** Set the address to the zero address to enable dev mode:

```dotenv
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
```

Then restart the server. In dev mode, all addresses are treated as
`dev-agent-1`.

### 402 Payment Required on verse endpoints

**Cause:** The x402 protocol requires a valid USDC payment. Payments are
real on-chain USDC transfers on Unichain Sepolia settled by the facilitator.

**Fix:** Use an x402-compatible HTTP client that can:
1. Parse the `payment-required` header from a 402 response (base64 JSON)
2. Sign a USDC `transferWithAuthorization` (EIP-3009)
3. Retry with the `PAYMENT-SIGNATURE` header (base64 JSON)

See `e2e/fixtures/x402-client.ts` for a working implementation using viem.

### Facilitator settlement fails

**Cause:** The facilitator wallet may not have enough ETH for gas, or the
USDC contract rejected the `transferWithAuthorization` call.

**Fixes:**
- Check facilitator wallet ETH balance on Unichain Sepolia
- Check payer wallet USDC balance (must cover the payment amount)
- Verify the facilitator is registered as a valid submitter by checking
  `curl -s http://localhost:4402/supported | jq .`

### JWT rejected on verse endpoints

**Cause:** The JWT has expired (24-hour lifetime) or was signed with a
different `JWT_SECRET` than the server is currently using.

**Fix:** Obtain a fresh JWT by repeating the auth flow. Ensure the
`JWT_SECRET` value in `.env.local` has not changed between when you
obtained the JWT and when you use it.

### curl returns HTML instead of JSON

**Cause:** You are hitting a Next.js page route instead of an API route.

**Fix:** Double-check the URL path. Verse oracle endpoints are at
`/v1/verse/lookup`, `/v1/verse/commentary`, `/v1/verse/oracle`. API
endpoints are at `/api/*`.
