// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const setLocation = vi.fn();
const resetRequiredUser = {
  id: 3,
  openId: 'local_personnel',
  username: 'alex.it',
  name: 'Alex IT',
  email: 'alex@example.com',
  loginMethod: 'password',
  passwordHash: null,
  mustChangePassword: true,
  isActive: true,
  role: 'user' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

vi.mock('wouter', () => ({
  Route: () => null,
  Switch: ({ children }: { children: React.ReactNode }) => children,
  useLocation: () => ['/', setLocation],
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { setData: vi.fn(), invalidate: vi.fn() } } }),
    auth: {
      me: { useQuery: () => ({ data: resetRequiredUser, isLoading: false, error: null }) },
      logout: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }) },
      changePassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/tooltip', () => ({ TooltipProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/DashboardLayout', () => ({ default: () => <div data-testid="dashboard-layout" /> }));
vi.mock('@/components/DashboardLayoutSkeleton', () => ({ DashboardLayoutSkeleton: () => <div data-testid="dashboard-skeleton" /> }));
vi.mock('@/components/ErrorBoundary', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/contexts/ThemeContext', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/pages/NotFound', () => ({ default: () => null }));
vi.mock('@/pages/Dashboard', () => ({ default: () => <div data-testid="dashboard-page" /> }));
vi.mock('@/pages/MasterInventory', () => ({ default: () => null }));
vi.mock('@/pages/LocationDetail', () => ({ default: () => null }));
vi.mock('@/pages/AuditHistory', () => ({ default: () => null }));
vi.mock('@/pages/Login', () => ({ default: () => null }));
vi.mock('@/pages/AdminUsers', () => ({ default: () => null }));
vi.mock('@/pages/ChangePassword', () => ({ default: () => <div data-testid="change-password-page" /> }));

import App from './App';

describe('forced password reset app integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLocation.mockClear();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('uses the auth.me session payload and redirects before dashboard rendering', async () => {
    await act(async () => root.render(<App />));

    expect(setLocation).toHaveBeenCalledWith('/change-password');
    expect(container.querySelector('[data-testid="dashboard-page"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeNull();
  });
});
