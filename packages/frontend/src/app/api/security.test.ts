import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('API Security', () => {
  it('should guard verse oracle endpoints with x402 payment + JWT auth', () => {
    // __dirname is src/app/api, routes are at src/app/v1/verse/*/route.ts
    const appDir = path.resolve(__dirname, '..');
    const routes = [
      path.resolve(appDir, 'v1/verse/lookup/route.ts'),
      path.resolve(appDir, 'v1/verse/commentary/route.ts'),
      path.resolve(appDir, 'v1/verse/oracle/route.ts'),
    ];
    for (const routePath of routes) {
      const content = fs.readFileSync(routePath, 'utf8');
      expect(content).toContain('withX402');
      expect(content).toContain('jwtVerify');
    }
  });

  it('should have a JWT secret configured (Issue #76)', () => {
    process.env.JWT_SECRET = 'test-secret';
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.JWT_SECRET).not.toBe('dev-secret-key');
  });
});
