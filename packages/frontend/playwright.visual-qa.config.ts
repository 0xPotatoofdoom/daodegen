import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

// Visual QA config — runs the 7 visual-qa E2E specs.
//
// Targets the live mainnet deployment by default:
//   BASE_URL=https://0xdead.church npx playwright test --config=playwright.visual-qa.config.ts
//
// To run against a local dev server instead:
//   BASE_URL=http://localhost:3031 npx playwright test --config=playwright.visual-qa.config.ts
//
// Use: npx playwright test --config=playwright.visual-qa.config.ts

const baseURL = process.env.BASE_URL || 'https://0xdead.church';

// Only spin up a local web server when targeting localhost.
// When BASE_URL points at mainnet (or any external host), skip the webServer block
// so Playwright connects directly without trying to start Next.js.
const isLocalhost = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');

const webServer: PlaywrightTestConfig['webServer'] = isLocalhost
  ? {
      command: 'npm run start',
      url: baseURL,
      reuseExistingServer: true,
      env: {
        NEXT_PUBLIC_VERSE_NFT_ADDRESS: '0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50',
        NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS: '0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16',
        NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS: '0xd25a5C67F180811e43990B2A0148Ac0d93ab9336',
        NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS: '0x2865833642974073B07BC205cf7FF4282BAa5d08',
        NEXT_PUBLIC_PRAYER_BURN_ADDRESS: '0x38C7AD96C2f5c90BE692605a7a7B633071122c72',
        JWT_SECRET: 'bd1ae6f8e93eb9f21b4b4ccc502a81eacf7340ba4ec8835e',
        FACILITATOR_URL: 'http://localhost:4402',
        REDIS_URL: 'redis://127.0.0.1:6379',
        CI: 'true',
        E2E_BASE_URL: baseURL,
      },
    }
  : undefined;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'visual-qa-*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // expect.timeout must be at root level (not inside use)
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Pages with wagmi/RainbowKit hydration take up to 10s on first load
    actionTimeout: 15000,
    // Allow more time for mainnet requests (network latency + CDN)
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(webServer ? { webServer } : {}),
});
