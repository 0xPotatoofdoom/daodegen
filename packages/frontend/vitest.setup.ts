import { vi } from 'vitest';

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-font',
    variable: '--font-inter',
  }),
}));
