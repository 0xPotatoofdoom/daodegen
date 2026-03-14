import { describe, it, expect } from 'vitest';
import { getNonce, verifyAgentIdentity } from './auth';
import { SiweMessage } from 'siwe';

describe('Authentication / SIWE', () => {
  it('evicts oldest nonces when MAX_NONCES (10_000) is reached', () => {
    // Fill the nonce store to trigger the eviction path
    for (let i = 0; i <= 10_000; i++) {
      getNonce();
    }
    // After eviction, getNonce() should still return a fresh valid nonce
    const nonce = getNonce();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('returns Verification failed for unparseable SIWE message', async () => {
    const result = await verifyAgentIdentity({
      message: 'this-is-not-a-valid-siwe-message',
      signature: '0x' + '0'.repeat(130),
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Verification failed');
  });

  it('should strictly validate nonces to prevent replay attacks (Issue #88)', async () => {
    const nonce = getNonce();
    
    const message = new SiweMessage({
      domain: 'localhost',
      address: '0x0000000000000000000000000000000000000000',
      statement: 'Sign in with Ethereum to the app.',
      uri: 'http://localhost',
      version: '1',
      chainId: 1301,
      nonce: nonce,
    }).prepareMessage();

    // Mock verification result since we don't have a real signature here
    // But we want to test that the NONCE is checked BEFORE signature verification if possible,
    // or just that we can't use the same nonce twice.
    
    // First attempt with valid nonce (but invalid signature for this test)
    const result1 = await verifyAgentIdentity({ 
        message, 
        signature: '0x' + '0'.repeat(130) 
    });
    // result1.error should be 'Invalid signature', NOT 'Invalid or expired nonce'
    expect(result1.error).toBe('Invalid signature');

    // Second attempt with SAME nonce
    const result2 = await verifyAgentIdentity({ 
        message, 
        signature: '0x' + '0'.repeat(130) 
    });
    expect(result2.error).toBe('Invalid or expired nonce');
  });
});