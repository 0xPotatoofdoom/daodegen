import { defineConfig, devices } from '@playwright/test';

// Visual QA config — only requires the frontend dev server.
// The x402 payment API tests use the real server but gracefully handle 402s.
// Use: npx playwright test --config=playwright.visual-qa.config.ts

export default defineConfig({
  testDir: './e2e',
  testMatch: 'visual-qa-*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // expect.timeout must be at root level (not inside use)
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3031',
    trace: 'on-first-retry',
    // Pages with wagmi/RainbowKit hydration take up to 10s on first load
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3031',
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_VERSE_NFT_ADDRESS: '0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50',
      NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS: '0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16',
      NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS: '0xd25a5C67F180811e43990B2A0148Ac0d93ab9336',
      NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_PRAYER_BURN_ADDRESS: '0x38C7AD96C2f5c90BE692605a7a7B633071122c72',
      JWT_SECRET: 'e2e-test-secret',
      FACILITATOR_URL: 'http://localhost:4402',
    },
  },
});
