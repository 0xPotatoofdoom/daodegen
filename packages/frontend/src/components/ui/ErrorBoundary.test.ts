import { describe, it, expect, vi } from 'vitest';

// Mock react
vi.mock('react', () => {
  class MockComponent {
    props: Record<string, unknown>;
    state: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
      this.state = {};
    }
    setState(newState: Record<string, unknown>) {
      this.state = { ...this.state, ...newState };
    }
    render() {
      return null;
    }
  }

  return {
    Component: MockComponent,
    default: {
      createElement: vi.fn(),
    },
  };
});

// Mock @sentry/nextjs
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import {
  ErrorBoundary,
  DefaultErrorFallback,
  NetworkErrorFallback,
  LoadingErrorFallback,
} from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('is exported as a class', () => {
    expect(typeof ErrorBoundary).toBe('function');
    // Class components have a prototype with render
    expect(ErrorBoundary.prototype).toBeDefined();
    expect(typeof ErrorBoundary.prototype.render).toBe('function');
  });

  describe('getDerivedStateFromError', () => {
    it('is a static method', () => {
      expect(typeof ErrorBoundary.getDerivedStateFromError).toBe('function');
    });

    it('returns state with hasError: true', () => {
      const error = new Error('Test error');
      const state = ErrorBoundary.getDerivedStateFromError(error);

      expect(state.hasError).toBe(true);
    });

    it('includes the error in returned state', () => {
      const error = new Error('Component crashed');
      const state = ErrorBoundary.getDerivedStateFromError(error);

      expect(state.error).toBe(error);
      expect(state.error!.message).toBe('Component crashed');
    });

    it('handles different error types', () => {
      const typeError = new TypeError('Cannot read property');
      const state = ErrorBoundary.getDerivedStateFromError(typeError);

      expect(state.hasError).toBe(true);
      expect(state.error).toBe(typeError);
    });

    it('returns correct state shape', () => {
      const error = new Error('test');
      const state = ErrorBoundary.getDerivedStateFromError(error);

      expect(Object.keys(state)).toContain('hasError');
      expect(Object.keys(state)).toContain('error');
    });
  });

  describe('componentDidCatch', () => {
    it('is defined on the prototype', () => {
      expect(typeof ErrorBoundary.prototype.componentDidCatch).toBe('function');
    });
  });

  describe('initial state', () => {
    it('starts with hasError: false', () => {
      // Access the initial state defined on the class
      const instance = new (ErrorBoundary as unknown as new (props: Record<string, unknown>) => {
        state: { hasError: boolean };
      })({});

      expect(instance.state.hasError).toBe(false);
    });
  });
});

describe('DefaultErrorFallback', () => {
  it('is exported as a function (React component)', () => {
    expect(typeof DefaultErrorFallback).toBe('function');
  });

  it('accepts onRetry, error, and className props', () => {
    // Verify the function signature by checking it doesn't throw when called with expected props
    // In node env without jsdom, calling the component returns JSX which is just an object
    expect(() => {
      DefaultErrorFallback({
        onRetry: () => {},
        error: new Error('test'),
        className: 'custom-class',
      });
    }).not.toThrow();
  });
});

describe('NetworkErrorFallback', () => {
  it('is exported as a function (React component)', () => {
    expect(typeof NetworkErrorFallback).toBe('function');
  });
});

describe('LoadingErrorFallback', () => {
  it('is exported as a function (React component)', () => {
    expect(typeof LoadingErrorFallback).toBe('function');
  });
});

describe('module exports', () => {
  it('exports all four components', async () => {
    const module = await import('./ErrorBoundary');

    expect(module.ErrorBoundary).toBeDefined();
    expect(module.DefaultErrorFallback).toBeDefined();
    expect(module.NetworkErrorFallback).toBeDefined();
    expect(module.LoadingErrorFallback).toBeDefined();
  });
});
