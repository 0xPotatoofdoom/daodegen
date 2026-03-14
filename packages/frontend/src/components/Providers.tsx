'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from '../lib/wagmi';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { isStaging, appEnv } from '../lib/env-client';
import '@rainbow-me/rainbowkit/styles.css';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount: number, error: Error) => {
          if (error && 'message' in error && error.message.includes('fetch')) {
            return failureCount < 3;
          }
          return false;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  }));

  return (
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme()}>
              {isStaging && (
                <div className="bg-amber-400 text-black text-center text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase py-2 border-b border-amber-500">
                  STAGING BUILD — NON-PRODUCTION DATA ({appEnv})
                </div>
              )}
              <div className="min-h-screen bg-gradient-to-br from-dao-dark via-slate-900 to-dao-purple/20">
                {children}
              </div>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}
