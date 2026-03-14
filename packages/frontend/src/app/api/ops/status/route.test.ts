import { describe, it, expect } from 'vitest';

import { GET } from './route';

describe('GET /api/ops/status', () => {
  it('returns 200 with system status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('node_env');
    expect(data).toHaveProperty('node_version');
    expect(data).toHaveProperty('uptime_seconds');
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('env_config');
  });

  it('returns node_env as a string', async () => {
    const response = await GET();
    const data = await response.json();

    expect(typeof data.node_env).toBe('string');
  });

  it('returns node_version matching process.version', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.node_version).toBe(process.version);
  });

  it('returns uptime_seconds as a non-negative integer', async () => {
    const response = await GET();
    const data = await response.json();

    expect(typeof data.uptime_seconds).toBe('number');
    expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(data.uptime_seconds)).toBe(true);
  });

  it('returns memory stats with rss_mb, heap_used_mb, heap_total_mb', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.memory).toHaveProperty('rss_mb');
    expect(data.memory).toHaveProperty('heap_used_mb');
    expect(data.memory).toHaveProperty('heap_total_mb');

    expect(typeof data.memory.rss_mb).toBe('number');
    expect(typeof data.memory.heap_used_mb).toBe('number');
    expect(typeof data.memory.heap_total_mb).toBe('number');
  });

  it('memory values are positive rounded integers in MB', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.memory.rss_mb).toBeGreaterThan(0);
    expect(data.memory.heap_used_mb).toBeGreaterThan(0);
    expect(data.memory.heap_total_mb).toBeGreaterThan(0);

    expect(Number.isInteger(data.memory.rss_mb)).toBe(true);
    expect(Number.isInteger(data.memory.heap_used_mb)).toBe(true);
    expect(Number.isInteger(data.memory.heap_total_mb)).toBe(true);
  });

  it('environment flags are booleans (not raw values)', async () => {
    const response = await GET();
    const data = await response.json();

    const envConfig = data.env_config;

    expect(typeof envConfig.jwt_secret).toBe('boolean');
    expect(typeof envConfig.anthropic_api_key).toBe('boolean');
    expect(typeof envConfig.sentry_dsn).toBe('boolean');
    expect(typeof envConfig.walletconnect_id).toBe('boolean');
    expect(typeof envConfig.facilitator_url).toBe('boolean');
    expect(typeof envConfig.ponder_api_url).toBe('boolean');
  });

  it('jwt_secret flag is true when JWT_SECRET env var is set', async () => {
    // vitest.config sets JWT_SECRET = 'test-secret'
    const response = await GET();
    const data = await response.json();

    expect(data.env_config.jwt_secret).toBe(true);
  });

  it('env_config contains all expected keys', async () => {
    const response = await GET();
    const data = await response.json();

    const expectedKeys = [
      'jwt_secret',
      'anthropic_api_key',
      'sentry_dsn',
      'walletconnect_id',
      'facilitator_url',
      'ponder_api_url',
    ];

    for (const key of expectedKeys) {
      expect(data.env_config).toHaveProperty(key);
    }
  });

  it('returns application/json content-type', async () => {
    const response = await GET();

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('heap_used_mb is less than or equal to heap_total_mb', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.memory.heap_used_mb).toBeLessThanOrEqual(data.memory.heap_total_mb);
  });

  it('returns 403 when NEXT_PUBLIC_APP_ENV is production', async () => {
    const saved = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    try {
      const response = await GET();
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Not available');
    } finally {
      process.env.NEXT_PUBLIC_APP_ENV = saved;
    }
  });
});
