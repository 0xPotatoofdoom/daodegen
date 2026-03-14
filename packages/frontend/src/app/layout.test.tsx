import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

describe('Layout Composition', () => {
  it('RootLayout should be a server component (not use "use client") (Issue #94)', async () => {
    // This is hard to test statically in Vitest, but we can check if it exports metadata
    // Client components cannot export metadata.
    const layout = await import('./layout');
    expect(layout.metadata).toBeDefined();
  });
});
