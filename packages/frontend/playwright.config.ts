import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3031';

// Only include the facilitator webServer when the key is available.
// Without it, Playwright would try to start it and fail immediately.
const webServers: NonNullable<PlaywrightTestConfig['webServer']> = [];

if (process.env.FACILITATOR_PRIVATE_KEY) {
  webServers.push({
    command: 'npm run start -w packages/facilitator',
    url: 'http://localhost:4402/health',
    reuseExistingServer: true,
    cwd: '../..',
    env: {
      FACILITATOR_PRIVATE_KEY: process.env.FACILITATOR_PRIVATE_KEY,
    },
  });
}

webServers.push({
  command: 'npm run start',
  url: baseURL,
  reuseExistingServer: true,
  env: {
    NEXT_PUBLIC_VERSE_NFT_ADDRESS: '0x63d24FADFe2431462bc7cC362e8aE1E3f17fAf50',
    NEXT_PUBLIC_DAODEGEN_TOKEN_ADDRESS: '0x9BbF24fDE364b328943ee2A21E818d6446Ff5a16',
    NEXT_PUBLIC_DAODEGEN_JAR_ADDRESS: '0xd25a5C67F180811e43990B2A0148Ac0d93ab9336',
    NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000000',
    NEXT_PUBLIC_PRAYER_BURN_ADDRESS: '0x38C7AD96C2f5c90BE692605a7a7B633071122c72',
    JWT_SECRET: 'bd1ae6f8e93eb9f21b4b4ccc502a81eacf7340ba4ec8835e',
    FACILITATOR_URL: 'http://localhost:4402',
    E2E_BASE_URL: baseURL,
    REDIS_URL: 'redis://127.0.0.1:6379',
  },
});

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'visual-qa-*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: webServers,
});
