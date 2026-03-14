'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { useTokenStats } from '@/hooks/useTokenStats';
import { chainConfig } from '@/lib/chain-config';
import { EnsAddress } from '@/components/EnsAddress';

// -- Types ------------------------------------------------------------------

interface OpsStatus {
  node_env: string;
  node_version: string;
  uptime_seconds: number;
  memory: { rss_mb: number; heap_used_mb: number; heap_total_mb: number };
  env_config: Record<string, boolean>;
}

interface EndpointResult {
  url: string;
  status: 'ok' | 'fail' | 'pending';
  latency_ms?: number;
}

interface ActivityEvent {
  type: 'mint' | 'claim' | 'fee_release' | 'prayer';
  timestamp: string;
  txHash: string;
  blockNumber: string;
  details: Record<string, string>;
}

// -- Helpers ----------------------------------------------------------------

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`}
    />
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// -- Endpoints to probe -----------------------------------------------------

const ENDPOINTS = [
  '/api/health',
  '/api/ops/status',
  '/api/auth/nonce',
  '/v1/congregation/state',
  '/.well-known/soul.json',
  '/.well-known/agent-registration.json',
];

// -- Component --------------------------------------------------------------

export default function OpsPage() {
  const [opsStatus, setOpsStatus] = useState<OpsStatus | null>(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointResult[]>(
    ENDPOINTS.map((url) => ({ url, status: 'pending' as const })),
  );
  const [probing, setProbing] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  const tokenStats = useTokenStats();

  // Fetch /api/ops/status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ops/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOpsStatus(await res.json());
      setOpsError(null);
    } catch (err) {
      setOpsError(String(err));
    }
  }, []);

  // Fetch activity feed from Ponder
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/ops/activity');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActivity(data.events ?? []);
      setActivityError(null);
    } catch (err) {
      setActivityError(String(err));
    }
  }, []);

  // Probe all endpoints
  const probeEndpoints = useCallback(async () => {
    setProbing(true);
    const results = await Promise.all(
      ENDPOINTS.map(async (url): Promise<EndpointResult> => {
        const start = Date.now();
        try {
          const res = await fetch(url);
          return {
            url,
            status: res.ok ? 'ok' : 'fail',
            latency_ms: Date.now() - start,
          };
        } catch {
          return { url, status: 'fail', latency_ms: Date.now() - start };
        }
      }),
    );
    setEndpoints(results);
    setProbing(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    probeEndpoints();
    fetchActivity();
  }, [fetchStatus, probeEndpoints, fetchActivity]);

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold text-dao-gold mb-8">Ops Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* ---- Panel 1: System Status (dev only) ---- */}
          {process.env.NEXT_PUBLIC_APP_ENV !== 'production' && (
          <div className="bg-slate-800/30 border border-dao-purple/30 rounded-lg p-5">
            <h2 className="text-lg font-semibold text-dao-gold mb-4">System Status</h2>
            {opsError && <p className="text-red-400 text-sm mb-2">{opsError}</p>}
            {opsStatus ? (
              <div className="space-y-3 text-sm">
                <Row label="Environment" value={opsStatus.node_env} />
                <Row label="Node" value={opsStatus.node_version} />
                <Row label="Uptime" value={formatUptime(opsStatus.uptime_seconds)} />
                <Row label="RSS" value={`${opsStatus.memory.rss_mb} MB`} />
                <Row label="Heap" value={`${opsStatus.memory.heap_used_mb} / ${opsStatus.memory.heap_total_mb} MB`} />

                <div className="pt-2 border-t border-slate-700">
                  <p className="text-gray-400 mb-2">Env Config</p>
                  <ul className="space-y-1">
                    {Object.entries(opsStatus.env_config).map(([key, ok]) => (
                      <li key={key} className="flex items-center gap-2 text-gray-300">
                        <StatusDot ok={ok} />
                        {key}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Loading...</p>
            )}
          </div>
          )}

          {/* ---- Panel 2: Contract Stats ---- */}
          <div className="bg-slate-800/30 border border-dao-purple/30 rounded-lg p-5">
            <h2 className="text-lg font-semibold text-dao-gold mb-4">Contract Stats</h2>
            {tokenStats.error ? (
              <p className="text-red-400 text-sm">{tokenStats.error}</p>
            ) : tokenStats.isLoading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : (
              <div className="space-y-3 text-sm">
                <Row label="NFTs Minted" value={tokenStats.nftsMinted} />
                <Row label="Jar Balance" value={tokenStats.jarBalance} />
                <Row label="Token Supply" value={tokenStats.tokenTotalSupply} />
                <Row label="Total Verses" value={tokenStats.totalNFTs} />
              </div>
            )}
          </div>

          {/* ---- Panel 3: Endpoint Health ---- */}
          <div className="bg-slate-800/30 border border-dao-purple/30 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-dao-gold">Endpoint Health</h2>
              <button
                onClick={() => { fetchStatus(); probeEndpoints(); }}
                disabled={probing}
                className="text-xs bg-dao-purple/60 hover:bg-dao-purple text-white px-3 py-1 rounded transition-colors disabled:opacity-50"
              >
                {probing ? 'Probing...' : 'Refresh'}
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {endpoints.map((ep) => (
                <li key={ep.url} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-300 truncate">
                    <StatusDot ok={ep.status === 'ok'} />
                    <span className="truncate">{ep.url}</span>
                  </span>
                  {ep.latency_ms != null && (
                    <span className="text-gray-500 ml-2 whitespace-nowrap">{ep.latency_ms}ms</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ---- Panel 4: On-Chain Activity Feed ---- */}
        <div className="bg-slate-800/30 border border-dao-purple/30 rounded-lg p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dao-gold">On-Chain Activity</h2>
            <button
              onClick={fetchActivity}
              className="text-xs bg-dao-purple/60 hover:bg-dao-purple text-white px-3 py-1 rounded transition-colors"
            >
              Refresh
            </button>
          </div>
          {activityError && <p className="text-red-400 text-sm mb-2">{activityError}</p>}
          {activity.length === 0 && !activityError ? (
            <p className="text-gray-500 text-sm">
              {activityError ? 'Ponder unavailable' : 'No events yet (or Ponder not connected)'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-slate-700">
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-left py-2 pr-4">Details</th>
                    <th className="text-left py-2">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.slice(0, 30).map((ev, i) => (
                    <tr key={`${ev.txHash}-${i}`} className="border-b border-slate-700/50">
                      <td className="py-2 pr-4">
                        <EventBadge type={ev.type} />
                      </td>
                      <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                        {formatTimestamp(ev.timestamp)}
                      </td>
                      <td className="py-2 pr-4 text-gray-300">
                        <EventDetails event={ev} />
                      </td>
                      <td className="py-2">
                        <a
                          href={`${chainConfig.explorerUrl}/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-dao-gold hover:underline font-mono text-xs"
                        >
                          {ev.txHash.slice(0, 8)}...
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

const EVENT_COLORS: Record<string, string> = {
  mint: 'bg-green-700/50 text-green-300',
  claim: 'bg-blue-700/50 text-blue-300',
  fee_release: 'bg-yellow-700/50 text-yellow-300',
  prayer: 'bg-purple-700/50 text-purple-300',
};

function EventBadge({ type }: { type: string }) {
  const label = type === 'fee_release' ? 'FEE' : type.toUpperCase();
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_COLORS[type] ?? 'bg-slate-700 text-gray-300'}`}>
      {label}
    </span>
  );
}

function EventDetails({ event }: { event: ActivityEvent }) {
  const d = event.details;
  const addrClass = "text-dao-gold hover:text-dao-purple transition-colors font-mono";

  switch (event.type) {
    case 'mint':
      return <span>Verse #{d.tokenId} minted by {d.minter && <EnsAddress address={d.minter} className={addrClass} />}</span>;
    case 'claim':
      return <span>Verse #{d.tokenId} claimed {d.amount} by {d.holder && <EnsAddress address={d.holder} className={addrClass} />}</span>;
    case 'fee_release':
      return <span>Fees released by {d.caller && <EnsAddress address={d.caller} className={addrClass} />} (burned {d.burnAmount}, {d.nftHolders} holders)</span>;
    case 'prayer':
      return <span>Prayer by {d.sender && <EnsAddress address={d.sender} className={addrClass} />} ({d.amount} DDGEN)</span>;
    default:
      return <span>{JSON.stringify(d)}</span>;
  }
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}
