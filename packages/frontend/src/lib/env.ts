import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(1),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).optional(),
  CDP_API_KEY_ID: z.string().min(1).optional(),
  CDP_API_KEY_SECRET: z.string().min(1).optional(),
  X402_PAY_TO: z.string().min(1).optional(),
  FACILITATOR_URL: z.string().min(1).default('http://localhost:4402'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  VENICE_API_KEY: z.string().min(1).optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  PONDER_API_URL: z.string().optional().default(''),
});

type Env = z.infer<typeof envSchema>;

const DEV_DEFAULTS: Env = {
  JWT_SECRET: 'dev-secret-do-not-use-in-production',
  FACILITATOR_URL: 'http://localhost:4402',
  PONDER_API_URL: '',
};

function parseEnv(): Env {
  const result = envSchema.safeParse({
    JWT_SECRET: process.env.JWT_SECRET,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    CDP_API_KEY_ID: process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET,
    X402_PAY_TO: process.env.X402_PAY_TO,
    FACILITATOR_URL: process.env.FACILITATOR_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    VENICE_API_KEY: process.env.VENICE_API_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    PONDER_API_URL: process.env.PONDER_API_URL,
  });

  if (result.success) {
    // Skip production guards during Next.js build phase — secrets are placeholders at build time
    // and will be validated at runtime when the server starts.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      const KNOWN_WEAK_SECRETS = new Set([
        'dev-secret-do-not-use-in-production',
        'build-placeholder',
        'change-me-in-production',
        'REPLACE_WITH_STRONG_SECRET_MIN_32_CHARS',
      ]);
      if (KNOWN_WEAK_SECRETS.has(result.data.JWT_SECRET)) {
        console.error(
          'FATAL: JWT_SECRET is set to a known placeholder value. ' +
            'Generate a strong random secret (>= 32 chars): openssl rand -base64 48',
        );
        process.exit(1);
      }
      if (result.data.JWT_SECRET.length < 32) {
        console.error(
          'FATAL: JWT_SECRET must be at least 32 characters. ' +
            'Generate one with: openssl rand -base64 48',
        );
        process.exit(1);
      }
      // Reject localhost facilitator in production unless E2E_BASE_URL is set
      // (E2E_BASE_URL signals a CI/e2e environment, not a real production deploy)
      if (
        result.data.FACILITATOR_URL === 'http://localhost:4402' &&
        !process.env.E2E_BASE_URL
      ) {
        console.error('[env] FACILITATOR_URL must be set explicitly in production');
        process.exit(1);
      }
    }
    return result.data;
  }

  const missing = result.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');

  if (process.env.NODE_ENV === 'production') {
    console.error(`[env] Missing required environment variables:\n${missing}`);
    process.exit(1);
  }

  console.warn(`[env] Missing environment variables (using dev defaults):\n${missing}`);
  return DEV_DEFAULTS;
}

export const env = parseEnv();

// Client-safe exports moved to env-client.ts to avoid triggering Zod parse
// on the client side (JWT_SECRET etc. are server-only).
export { isNonProduction, appEnv, isStaging } from './env-client';
