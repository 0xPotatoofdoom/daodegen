import pino from 'pino';
import { randomUUID } from 'crypto';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

/**
 * Create a child logger for an API route handler.
 * Accepts an optional traceId (from x-request-id header) —
 * if not provided, generates a new UUID.
 */
export function reqLogger(route: string, traceId?: string) {
  const id = traceId || randomUUID();
  return logger.child({ traceId: id, route });
}

export default logger;
