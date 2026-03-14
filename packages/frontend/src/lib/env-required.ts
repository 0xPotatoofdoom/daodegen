/**
 * Require an environment variable, throwing in production if unset.
 * In development/test, falls back to the provided default.
 */
export function requireEnv(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }
  return devFallback;
}
