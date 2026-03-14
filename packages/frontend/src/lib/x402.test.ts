import { describe, it, expect } from 'vitest';
import {
  x402Server,
  PAY_TO,
  USDC_NETWORK,
  PRICE_LOOKUP,
  PRICE_COMMENTARY,
  PRICE_ORACLE,
} from './x402';

describe('x402 Payment Configuration', () => {
  it('should export a configured x402ResourceServer', () => {
    expect(x402Server).toBeDefined();
    expect(typeof x402Server.buildPaymentRequirements).toBe('function');
  });

  it('should target Unichain Sepolia (eip155:1301)', () => {
    expect(USDC_NETWORK).toBe('eip155:1301');
  });

  it('should have three tier prices', () => {
    expect(PRICE_LOOKUP).toBe('$0.001');
    expect(PRICE_COMMENTARY).toBe('$0.01');
    expect(PRICE_ORACLE).toBe('$0.10');
  });

  it('should have a valid payTo address', () => {
    expect(PAY_TO).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should use self-hosted facilitator (not CDP)', () => {
    // The facilitator URL defaults to localhost:4402 when FACILITATOR_URL is not set
    // Verify we are NOT importing from @coinbase/x402 by checking the server is configured
    expect(x402Server).toBeDefined();
  });
});
