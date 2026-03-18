import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(1),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).optional(),
  CDP_API_KEY_ID: z.string().min(1).optional(),
  CDP_API_KEY_SECRET: z.string().min(1).optional(),
  X402_PAY_TO: z.string().min(1).optional(),
  FACILITATOR_URL: z.string().min(1).default(
    process.env.NODE_ENV === 'production'
      ? '' // must be set explicitly in production
      : 'http://localhost:4402'
  ),
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
    if (process.env.NODE_ENV === 'production') {
      if (result.data.JWT_SECRET === 'dev-secret-do-not-use-in-production') {
        console.error('[env] JWT_SECRET must not use the dev default in production');
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

// --- Production guard: in-memory state stores (#250) ---
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
  console.warn(
    '\n⚠️  [env] REDIS_URL is not set in production!\n' +
    '   Rate limits, nonces, and nullifiers are using in-memory stores.\n' +
    '   They will NOT survive restarts and will NOT work across replicas.\n' +
    '   Set REDIS_URL to enable persistent, shared state.\n'
  );
}

// Client-safe exports moved to env-client.ts to avoid triggering Zod parse
// on the client side (JWT_SECRET etc. are server-only).
export { isNonProduction, appEnv, isStaging } from './env-client';
