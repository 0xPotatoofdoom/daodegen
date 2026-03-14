// Client-safe environment helpers -- no server-only secrets here.
// Separated from env.ts so that client components can import these
// without triggering the Zod schema parse that requires JWT_SECRET etc.

export const isNonProduction = process.env.NODE_ENV !== 'production';

export const appEnv = process.env.NODE_ENV || 'development';
export const isStaging = process.env.NEXT_PUBLIC_APP_ENV === 'staging';
