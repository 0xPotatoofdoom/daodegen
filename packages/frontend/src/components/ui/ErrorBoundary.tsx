'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    })
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback onRetry={() => this.setState({ hasError: false })} />
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  onRetry?: () => void
  error?: Error
  className?: string
}

export function DefaultErrorFallback({ onRetry, error, className = '' }: ErrorFallbackProps) {
  return (
    <div className={`text-center py-8 px-4 ${className}`}>
      <div className="max-w-md mx-auto">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-red-400 mb-2">
          Something went wrong
        </h3>
        <p className="text-gray-400 mb-4">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-dao-purple hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors min-h-[44px] flex items-center justify-center mx-auto gap-2"
          >
            🔄 Try Again
          </button>
        )}
      </div>
    </div>
  )
}

export function NetworkErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <DefaultErrorFallback
      onRetry={onRetry}
      error={{ message: 'Network connection failed. Check your internet connection and try again.' } as Error}
    />
  )
}

export function LoadingErrorFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <DefaultErrorFallback
      onRetry={onRetry}
      error={{ message: 'Failed to load content. This might be due to a slow connection.' } as Error}
    />
  )
}