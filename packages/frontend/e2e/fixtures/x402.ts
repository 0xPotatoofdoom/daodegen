/**
 * x402 E2E test helpers.
 *
 * Full x402 payment flow tests require:
 * 1. A test wallet funded with USDC on Unichain Sepolia
 * 2. Signing an EIP-3009 transferWithAuthorization
 * 3. Constructing the X-PAYMENT header
 *
 * For now, these helpers document the expected structure. Real on-chain
 * payment tests should be run against a testnet with funded wallets.
 */

// USDC contract on Unichain Sepolia
export const USDC_ADDRESS = '0x31d0220469e10c4E71834a79b1f276d740d3768F';

// Deployer / payTo address
export const PAY_TO = '0x3D0e10329c864A7422761af058f909267a776029';

// Network identifier (CAIP-2)
export const NETWORK = 'eip155:1301';

// Price in USDC
export const PRICE = '$0.10';

/**
 * Structure of the X-PAYMENT header payload (base64-encoded JSON).
 * The x402 SDK handles construction; this documents the expected shape.
 */
export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
}
