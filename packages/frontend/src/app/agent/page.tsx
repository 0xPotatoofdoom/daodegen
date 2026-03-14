'use client'

import { useState } from 'react';
import { useAccount, useWalletClient, useWriteContract } from 'wagmi';
import { SiweMessage } from 'siwe';
import { CONTRACT_ADDRESSES, AGENT_REGISTRY_ABI, chainConfig } from '@/lib/contracts';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Navigation } from '@/components/Navigation';

export default function AgentPage() {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [oracleResult, setOracleResult] = useState<any>(null);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCallingOracle, setIsCallingOracle] = useState(false);

  const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const registerAgent = async () => {
    if (!address || isRegistering) return;
    setIsRegistering(true);
    try {
      log('Registering Agent Identity...');
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.AGENT_REGISTRY as `0x${string}`,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'register',
        args: ['ipfs://bafy...metadata'],
      });
      log(`Transaction sent: ${hash}`);
    } catch (e: unknown) {
      console.error(e);
      log(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const login = async () => {
    if (!walletClient || !address || isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      log('Requesting nonce...');
      const nonceRes = await fetch('/api/auth/nonce');
      const { nonce } = await nonceRes.json();

      log('Signing SIWE message...');
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to DaoDeGen Agent API',
        uri: window.location.origin,
        version: '1',
        chainId: chainId || 1,
        nonce,
      });

      const signature = await walletClient.signMessage({
        message: message.prepareMessage(),
      });

      log('Verifying signature...');
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ message: message.prepareMessage(), signature }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'Login failed');
      }

      const { token } = await verifyRes.json();
      setAuthToken(token);
      log('Login successful! JWT received.');
    } catch (e: unknown) {
      console.error(e);
      log(`Login Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const callOracle = async (tier: 'lookup' | 'commentary' | 'oracle') => {
    if (isCallingOracle) return;
    setIsCallingOracle(true);
    const endpoints: Record<string, { url: string; body: object; price: string }> = {
      lookup: {
        url: '/v1/verse/lookup',
        body: { verse: 1 },
        price: '$0.001',
      },
      commentary: {
        url: '/v1/verse/commentary',
        body: { verse: 1, context: 'I am considering providing concentrated liquidity on a volatile pair' },
        price: '$0.01',
      },
      oracle: {
        url: '/v1/verse/oracle',
        body: { state: 'I hold 50 ETH in a lending protocol, recently exited a leveraged long, market is ranging' },
        price: '$0.10',
      },
    };

    const { url, body, price } = endpoints[tier];
    setSelectedTier(tier);

    try {
      log(`Calling ${tier} endpoint (${price} USDC)...`);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.status === 402) {
        log(`402 Payment Required -- ${price} USDC via x402 protocol.`);
        setPaymentRequired(true);
        setOracleResult(null);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setOracleResult(data);
        setPaymentRequired(false);
        log(`${tier} response received.`);
      } else {
        const err = await res.json();
        log(`Error: ${err.error}`);
      }
    } catch (e: unknown) {
      console.error(e);
      log(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsCallingOracle(false);
    }
  };

  return (
    <main className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-6 py-12 text-white">
      <h1 className="text-4xl font-bold mb-8 text-dao-gold">Agent Dashboard (EIP-8004 + x402)</h1>

      <div className="mb-8">
        <ConnectButton />
      </div>

      {isConnected && (
        <div className="grid gap-8 md:grid-cols-2">
            <div className="border border-dao-purple bg-slate-900/50 p-6 rounded-xl backdrop-blur-sm">
                <h2 className="text-2xl mb-4 font-bold text-dao-purple">1. Identity (EIP-8004)</h2>
                <div className="space-y-4">
                    <button
                        onClick={registerAgent}
                        disabled={isRegistering}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg w-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRegistering ? 'Registering...' : 'Register Agent Identity (On-Chain)'}
                    </button>
                    <button
                        onClick={login}
                        disabled={isLoggingIn}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg w-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoggingIn ? 'Signing in...' : 'Login with SIWE'}
                    </button>
                </div>
                {authToken && (
                    <div className="mt-4 p-3 bg-green-900/30 border border-green-500/30 rounded text-green-400 text-sm break-all">
                        <strong>Authenticated!</strong><br/>
                        JWT: {authToken.substring(0, 20)}...
                    </div>
                )}
            </div>

            <div className="border border-dao-gold bg-slate-900/50 p-6 rounded-xl backdrop-blur-sm">
                <h2 className="text-2xl mb-4 font-bold text-dao-gold">2. Verse Oracle (x402 / USDC)</h2>
                <div className="space-y-3">
                    <button
                        onClick={() => callOracle('lookup')}
                        disabled={isCallingOracle}
                        className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-3 rounded-lg w-full font-semibold transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="block">{isCallingOracle && selectedTier === 'lookup' ? 'Calling...' : 'Tier 1: Verse Lookup'}</span>
                        <span className="text-xs text-amber-300">$0.001 USDC -- verse text + base interpretation</span>
                    </button>
                    <button
                        onClick={() => callOracle('commentary')}
                        disabled={isCallingOracle}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-lg w-full font-semibold transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="block">{isCallingOracle && selectedTier === 'commentary' ? 'Calling...' : 'Tier 2: Contextual Commentary'}</span>
                        <span className="text-xs text-amber-200">$0.01 USDC -- AI interpretation scoped to your situation</span>
                    </button>
                    <button
                        onClick={() => callOracle('oracle')}
                        disabled={isCallingOracle}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-lg w-full font-semibold transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="block">{isCallingOracle && selectedTier === 'oracle' ? 'Calling...' : 'Tier 3: Verse Oracle'}</span>
                        <span className="text-xs text-amber-100">$0.10 USDC -- the temple picks a verse FOR you</span>
                    </button>
                </div>

                {paymentRequired && (
                    <div className="mt-4 bg-slate-800 p-5 rounded-lg border border-amber-500/50">
                        <p className="mb-3 font-bold text-amber-400">Payment Required (x402)</p>
                        <p className="text-sm text-gray-300 mb-3">
                            The {selectedTier} endpoint requires USDC payment on {chainConfig.chainName} via x402.
                        </p>
                        <p className="text-sm text-gray-400 mb-2">
                            An x402-compatible HTTP client will automatically handle payment, retry, and settlement.
                        </p>
                        <div className="text-xs font-mono bg-slate-900 p-3 rounded border border-slate-700 text-gray-400">
                            Network: eip155:{chainConfig.chainId} ({chainConfig.chainName})<br/>
                            Token: USDC<br/>
                            PayTo: 0x3D0e...6029
                        </div>
                    </div>
                )}

                {oracleResult && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-green-900 to-emerald-900 rounded-lg border border-green-500/50 shadow-lg">
                        <h3 className="font-bold text-green-300 mb-2">
                            {oracleResult.recommended_verse
                                ? `Oracle Selected: Verse ${oracleResult.recommended_verse}`
                                : `Verse ${oracleResult.verse}`}
                            {oracleResult.title && ` -- ${oracleResult.title}`}
                        </h3>
                        <pre className="text-white text-sm leading-relaxed whitespace-pre-wrap font-serif mb-3">
                            {oracleResult.text}
                        </pre>
                        {oracleResult.interpretation && (
                            <p className="text-green-200 italic text-sm">{oracleResult.interpretation}</p>
                        )}
                        {oracleResult.commentary && (
                            <p className="text-green-200 italic text-sm">{oracleResult.commentary}</p>
                        )}
                        {oracleResult.oracle_reading && (
                            <p className="text-green-200 italic text-sm">{oracleResult.oracle_reading}</p>
                        )}
                        {oracleResult.reasoning && (
                            <p className="text-gray-400 text-xs mt-2">{oracleResult.reasoning}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      <div className="mt-8 border border-gray-700 bg-black/80 p-4 rounded-lg font-mono text-xs h-48 overflow-y-auto">
        <div className="text-gray-500 mb-2">System Logs:</div>
        {logs.map((log, i) => (
            <div key={i} className="text-green-500/80 border-b border-gray-800/50 py-1">{log}</div>
        ))}
        {logs.length === 0 && <div className="text-gray-700 italic">No activity yet...</div>}
      </div>
      </div>
    </main>
  );
}
