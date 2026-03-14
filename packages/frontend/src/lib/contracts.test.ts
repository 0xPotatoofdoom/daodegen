import { describe, it, expect } from 'vitest';
import { CONTRACT_ADDRESSES, DAODEGEN_JAR_ABI } from './contracts';

describe('Contract Integration', () => {
  it('should not have zero addresses for production contracts', () => {
    // These should fail because they are currently all 0x00...
    expect(CONTRACT_ADDRESSES.VERSE_NFT).not.toBe('0x0000000000000000000000000000000000000000');
    expect(CONTRACT_ADDRESSES.DAODEGEN_TOKEN).not.toBe('0x0000000000000000000000000000000000000000');
    expect(CONTRACT_ADDRESSES.DAODEGEN_JAR).not.toBe('0x0000000000000000000000000000000000000000');
    expect(CONTRACT_ADDRESSES.AGENT_REGISTRY).not.toBe('0x0000000000000000000000000000000000000000');
  });

  it('should have correct ABI for DaoDeGenJar.release (Issue #91, #132)', () => {
    const releaseFn = DAODEGEN_JAR_ABI.find(s => s.type === 'function' && s.name === 'release');
    // V4 Currency is `type Currency is address` -- ABI encoding uses address[]
    expect(releaseFn).toBeDefined();
    expect(releaseFn!.inputs[0].type).toBe('address[]');
  });
});
