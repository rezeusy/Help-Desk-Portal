// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { hashPassword } from '../../server/_core/localAuth';
import type { TrpcContext } from '../../server/_core/context';
import { appRouter } from '../../server/routers';

const { getUserByUsername, markUserSignedIn } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  markUserSignedIn: vi.fn(),
}));

vi.mock('../../server/db', () => ({ getUserByUsername, markUserSignedIn }));
vi.mock('../../server/_core/sdk', () => ({ sdk: { createSessionToken: vi.fn().mockResolvedValue('session-token') } }));

const setLocation = vi.fn();
let restoredAuthMe: Record<string, unknown> | null = null;

vi.mock('wouter', () => ({
  Route: () => null,
  Switch: ({ children }: { children: React.ReactNode }) => children,
  useLocation: () => ['/', setLocation],
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { setData: vi.fn(), invalidate: vi.fn() } } }),
    auth: {
      me: { useQuery: () => ({ data: restoredAuthMe, isLoading: false, error: null }) },
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

describe('single-chain forced reset integration', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLocation.mockClear();
    getUserByUsername.mockReset();
    markUserSignedIn.mockReset();
    restoredAuthMe = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('chains login, restored auth.me state, and the real App redirect before dashboard render', async () => {
    const passwordHash = await hashPassword('temporary-password');
    const resetRequiredUser = {
      id: 3,
      openId: 'local_personnel',
      username: 'alex.it',
      name: 'Alex IT',
      email: 'alex@example.com',
      loginMethod: 'password',
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    getUserByUsername.mockResolvedValue(resetRequiredUser);
    markUserSignedIn.mockResolvedValue(undefined);

    const loginContext: TrpcContext = {
      user: null,
      req: { protocol: 'https', headers: {} } as TrpcContext['req'],
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext['res'],
    };
    const loginResult = await appRouter.createCaller(loginContext).auth.login({ username: 'alex.it', password: 'temporary-password' });

    const restoredContext: TrpcContext = {
      ...loginContext,
      user: { ...resetRequiredUser, ...loginResult.user, passwordHash: null },
    };
    restoredAuthMe = await appRouter.createCaller(restoredContext).auth.me();

    await act(async () => root.render(<App />));

    expect(loginResult.mustChangePassword).toBe(true);
    expect(restoredAuthMe?.mustChangePassword).toBe(true);
    expect(setLocation).toHaveBeenCalledWith('/change-password');
    expect(container.querySelector('[data-testid="dashboard-page"]')).toBeNull();
    expect(container.querySelector('[data-testid="dashboard-layout"]')).toBeNull();
  });
});
