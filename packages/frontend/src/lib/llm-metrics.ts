/**
 * LLM provider failover metrics.
 *
 * Tracks success/failure counts per provider. Exposed at GET /api/ops
 * for observability. Uses Redis when available, in-memory otherwise.
 */

interface ProviderMetrics {
  provider: string;
  successes: number;
  failures: number;
  failovers: number;
  lastSuccess: number | null;
  lastFailure: number | null;
  lastError: string | null;
}

const metrics = new Map<string, ProviderMetrics>();

function getMetrics(provider: string): ProviderMetrics {
  let m = metrics.get(provider);
  if (!m) {
    m = {
      provider,
      successes: 0,
      failures: 0,
      failovers: 0,
      lastSuccess: null,
      lastFailure: null,
      lastError: null,
    };
    metrics.set(provider, m);
  }
  return m;
}

export function recordSuccess(provider: string): void {
  const m = getMetrics(provider);
  m.successes++;
  m.lastSuccess = Date.now();
}

export function recordFailure(provider: string, error: string): void {
  const m = getMetrics(provider);
  m.failures++;
  m.lastFailure = Date.now();
  m.lastError = error.slice(0, 200);
}

export function recordFailover(fromProvider: string, toProvider: string): void {
  const m = getMetrics(fromProvider);
  m.failovers++;
  console.warn(`[llm] Failover: ${fromProvider} → ${toProvider}`);
}

export function getAllMetrics(): ProviderMetrics[] {
  return Array.from(metrics.values());
}

export function getActiveProvider(): string {
  // Return the provider with the most recent success
  let best: ProviderMetrics | null = null;
  for (const m of metrics.values()) {
    if (!best || (m.lastSuccess && (!best.lastSuccess || m.lastSuccess > best.lastSuccess))) {
      best = m;
    }
  }
  return best?.provider ?? "unknown";
}
