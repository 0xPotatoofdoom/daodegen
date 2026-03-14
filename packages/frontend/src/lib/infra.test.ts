import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Project Integrity & CI/CD', () => {
  it('should have a CI workflow configured (Issue #77)', () => {
    const workflowPath = path.resolve(process.cwd(), '../../.github/workflows/ci.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('should have a root .gitignore (Issue #73)', () => {
    const gitignorePath = path.resolve(process.cwd(), '../../.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
  });
});

describe('Infrastructure & Quality', () => {
  it('should have Playwright configured for E2E (Issue #98)', () => {
    const configPath = path.resolve(process.cwd(), 'playwright.config.ts');
    expect(fs.existsSync(configPath)).toBe(true);
  });
});
