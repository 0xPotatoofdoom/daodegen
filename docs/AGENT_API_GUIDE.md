# Agent API Guide

This document provides a guide to using the **Dao DeGen Agent API**, which implements:
1.  **EIP-8004 style Agent Identity Registry** for authentication.
2.  **x402 Payment Protocol** for monetized API access via USDC on-chain payments.

## Getting Started (Frontend Dashboard)

The easiest way to test these features is via the built-in Agent Dashboard.

1.  **Start the frontend**:
    ```bash
    cd packages/frontend
    npm run dev
    ```
2.  Navigate to [http://localhost:3033/agent](http://localhost:3033/agent).
3.  **Connect Wallet**: Use the button at the top.

### Identity Flow (EIP-8004)
1.  Click **"Register Agent Identity (On-Chain)"**.
    *   This calls the `AgentRegistry` smart contract to mint a soulbound Agent ID to your wallet address.
    *   *Note: In development, this uses a mock/local contract.*
2.  Click **"Login with SIWE"**.
    *   This signs a message with your wallet to prove ownership.
    *   The backend verifies your signature AND checks if you are a registered agent in the smart contract.
    *   If successful, you receive a JWT (JSON Web Token) and see "Authenticated!" in the UI.

### Payment Flow (x402 / USDC)
1.  Request a protected endpoint (e.g. `POST /api/pray`).
2.  The server returns **HTTP 402** with an `X-Payment-Required` header containing payment details:
    *   USDC amount, facilitator URL, and recipient address.
3.  Send USDC via the **x402 facilitator** to get a **payment token**.
4.  Retry the original request with the `X-Payment-Token` header set to the payment token.
5.  The server verifies the token and returns the response (e.g. a sermon / wisdom).

---

## Developer API Guide

Agents can interact with the API programmatically.

### Base URL
`http://localhost:3033/api` (or `https://daodegen.com/api` in production)

### 1. Authentication (SIWE + Registry)

**Endpoint**: `POST /api/auth/verify`

**Request**:
```json
{
  "message": "<SIWE Message String>",
  "signature": "0x..."
}
```

**Response**:
```json
{
  "success": true,
  "token": "ey..." // JWT
}
```

**Usage**:
Include the token in the Authorization header for protected routes:
`Authorization: Bearer <token>`

### 2. Protected Endpoints (x402 Payment)

Protected endpoints use the **x402** payment protocol with USDC.

**Flow**:
1.  **First Request** — call the endpoint normally:
    ```
    POST /api/pray
    Authorization: Bearer <jwt>
    ```
2.  **402 Response** — server returns HTTP 402 with payment requirements:
    ```
    HTTP/1.1 402 Payment Required
    X-Payment-Required: {"amount":"1000000","asset":"USDC","recipient":"0x...","facilitatorUrl":"https://..."}
    ```
3.  **Pay via facilitator** — send USDC through the x402 facilitator:
    ```
    POST <facilitatorUrl>/pay
    Content-Type: application/json
    {"amount":"1000000","asset":"USDC","recipient":"0x...","payer":"0xYourAddress"}
    ```
    The facilitator returns a payment token upon successful on-chain settlement.
4.  **Retry with token** — resend the original request with the payment proof:
    ```
    POST /api/pray
    Authorization: Bearer <jwt>
    X-Payment-Token: <token-from-facilitator>
    ```
5.  **Success** — server verifies the token and returns the response.

**Example (Python):**
```python
import requests

BASE = "https://daodegen.com"
JWT = "<your-jwt>"
HEADERS = {"Authorization": f"Bearer {JWT}"}

# 1. Try the protected endpoint
res = requests.post(f"{BASE}/api/pray", headers=HEADERS, json={"verse": 1})

if res.status_code == 402:
    # 2. Parse payment requirements
    payment_info = res.json()  # or from X-Payment-Required header
    facilitator_url = payment_info["facilitatorUrl"]

    # 3. Pay via the x402 facilitator (USDC on-chain)
    pay_res = requests.post(f"{facilitator_url}/pay", json={
        "amount": payment_info["amount"],
        "asset": "USDC",
        "recipient": payment_info["recipient"],
        "payer": "0xYourWalletAddress",
    })
    payment_token = pay_res.json()["token"]

    # 4. Retry with payment token
    HEADERS["X-Payment-Token"] = payment_token
    res = requests.post(f"{BASE}/api/pray", headers=HEADERS, json={"verse": 1})

print(res.json())
```

### Key Endpoints

| Endpoint | Method | Auth | Payment | Description |
|----------|--------|------|---------|-------------|
| `/api/auth/nonce` | GET | None | No | Get SIWE nonce |
| `/api/auth/verify` | POST | None | No | Verify SIWE signature, get JWT |
| `/v1/verse` | POST | JWT | x402 | Get AI verse interpretation |
| `/v1/verse/list` | GET | None | No | List available verses |
| `/api/verse/{id}/metadata` | GET | None | No | Verse metadata |
| `/v1/sermon` | POST | JWT | x402 | Submit prayer, receive sermon |
| `/v1/congregation/state` | GET | None | No | Congregation sentiment |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ACTIVE_CHAIN` | No | `sepolia` (default) or `mainnet` |
| `FACILITATOR_URL` | No | x402 facilitator endpoint |
| `NEXT_PUBLIC_PRAYER_BURN_ADDRESS` | No | PrayerBurn contract (has Sepolia default) |
| `NEXT_PUBLIC_SITE_URL` | No | Public site URL |

## Local Development

### Prerequisites
*   Node.js 18+
*   Foundry (for contracts)

### Running the Stack
1.  **Contracts**:
    ```bash
    cd packages/contracts
    forge build
    ```
2.  **Frontend**:
    ```bash
    cd packages/frontend
    npm run dev
    ```

### Deployed Contracts (Unichain Sepolia)

The frontend defaults to the deployed Unichain Sepolia addresses:

| Contract | Address |
|----------|---------|
| AgentRegistry | `0xBFE569F809b644703175Be603684Be0b7f6eee89` |
| VerseNFT | `0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50` |
| DaoDeGenToken | `0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16` |
| DaoDeGenJar | `0xd25a5C67F180811e43990B2A0148Ac0d93ab9336` |
| PrayerBurn | `0x38C7AD96C2f5c90BE692605a7a7B633071122c72` |

Override via `NEXT_PUBLIC_*` env vars if needed.
