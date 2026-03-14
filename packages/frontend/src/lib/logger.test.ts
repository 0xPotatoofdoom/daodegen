import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mocks that are available during vi.mock hoisting
const { pinoMock, childMock, mockRandomUUID, pinoInitCalls } = vi.hoisted(() => {
  const childMock = vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn() });
  const pinoInitCalls: Array<unknown[]> = [];
  const pinoMock = vi.fn((...args: unknown[]) => {
    pinoInitCalls.push(args);
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: childMock,
      level: 'info',
    };
  });
  const mockRandomUUID = vi.fn().mockReturnValue('test-uuid-1234');
  return { pinoMock, childMock, mockRandomUUID, pinoInitCalls };
});

// Mock pino before importing logger
vi.mock('pino', () => {
  return { default: pinoMock };
});

// Mock crypto.randomUUID
vi.mock('crypto', () => ({
  randomUUID: mockRandomUUID,
}));

import logger, { reqLogger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    // Only clear child and randomUUID mocks, not pino (which was called at init)
    childMock.mockClear();
    mockRandomUUID.mockClear();
    mockRandomUUID.mockReturnValue('test-uuid-1234');
  });

  it('exports a default logger object', () => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('logger has standard logging methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('logger has child method', () => {
    expect(typeof logger.child).toBe('function');
  });

  describe('reqLogger', () => {
    it('is a function export', () => {
      expect(typeof reqLogger).toBe('function');
    });

    it('returns a child logger with traceId and route', () => {
      const childLogger = reqLogger('/api/test');

      expect(logger.child).toHaveBeenCalledWith({
        traceId: 'test-uuid-1234',
        route: '/api/test',
      });
      expect(childLogger).toBeDefined();
    });

    it('uses provided traceId instead of generating one', () => {
      reqLogger('/api/test', 'custom-trace-id');

      expect(logger.child).toHaveBeenCalledWith({
        traceId: 'custom-trace-id',
        route: '/api/test',
      });
      expect(mockRandomUUID).not.toHaveBeenCalled();
    });

    it('creates a unique traceId for each call when none provided', () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-aaa')
        .mockReturnValueOnce('uuid-bbb');

      reqLogger('/api/first');
      reqLogger('/api/second');

      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({ traceId: 'uuid-aaa' })
      );
      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({ traceId: 'uuid-bbb' })
      );
    });

    it('passes the route to child logger', () => {
      reqLogger('/api/verses');

      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/api/verses' })
      );
    });

    it('calls randomUUID for each request', () => {
      reqLogger('/api/test1');
      reqLogger('/api/test2');

      expect(mockRandomUUID).toHaveBeenCalledTimes(2);
    });
  });
});

describe('logger configuration', () => {
  // These tests use pinoInitCalls which captures all calls made during module init
  // and is NOT affected by vi.clearAllMocks.

  it('pino is called during module initialization', () => {
    expect(pinoInitCalls.length).toBeGreaterThan(0);
  });

  it('pino is called with a config object', () => {
    const callArgs = pinoInitCalls[0][0] as Record<string, unknown>;
    expect(callArgs).toBeDefined();
    expect(typeof callArgs).toBe('object');
  });

  it('configures log level from LOG_LEVEL env or defaults to info', () => {
    const callArgs = pinoInitCalls[0][0] as Record<string, unknown>;
    // The source code: level: process.env.LOG_LEVEL || 'info'
    expect(callArgs.level).toBeDefined();
    // Since LOG_LEVEL is not set in test env, it defaults to 'info'
    expect(callArgs.level).toBe('info');
  });

  it('pino is called exactly once (single logger instance)', () => {
    expect(pinoInitCalls).toHaveLength(1);
  });
});
