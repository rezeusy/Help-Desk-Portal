// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const setLocation = vi.fn();
const exportWorkbook = vi.hoisted(() => vi.fn(() => 'it-inventory-summary-2026-08-25.xlsx'));

vi.mock('wouter', () => ({
  Route: ({ component: Component }: { component?: React.ComponentType }) => Component ? <Component /> : null,
  Switch: ({ children }: { children: React.ReactNode }) => children,
  useLocation: () => ['/', setLocation],
}));

vi.mock('./_core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: 'admin', mustChangePassword: false }, loading: false }),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { setData: vi.fn(), invalidate: vi.fn() } } }),
    stats: {
      dashboard: {
        useQuery: () => ({
          data: {
            totalItems: 1,
            totalQty: 4,
            deployedQty: 1,
            availableQty: 3,
            byCategory: { Computer: { types: 1, units: 4 } },
            byLocation: [],
            locations: [],
          },
          isLoading: false,
        }),
      },
    },
    reports: {
      inventoryExport: {
        useQuery: () => ({
          data: {
            items: [{ id: 'LAP', name: 'Laptop', category: 'Computer', totalQty: 4, deployedQty: 1, notes: null }],
            locations: [{ id: 'HQ', name: 'Headquarters', items: [{ itemId: 'LAP', deployedQty: 1 }] }],
          },
          isLoading: false,
        }),
      },
    },
  },
}));
vi.mock('@/lib/inventoryExport', () => ({ exportInventoryWorkbook: exportWorkbook }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/tooltip', () => ({ TooltipProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('./components/ErrorBoundary', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('./contexts/ThemeContext', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('./components/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('./components/DashboardLayoutSkeleton', () => ({ DashboardLayoutSkeleton: () => null }));
vi.mock('@/pages/NotFound', () => ({ default: () => null }));
vi.mock('./pages/MasterInventory', () => ({ default: () => null }));
vi.mock('@/pages/LocationDetail', () => ({ default: () => null }));
vi.mock('@/pages/AuditHistory', () => ({ default: () => null }));
vi.mock('./pages/Login', () => ({ default: () => null }));
vi.mock('./pages/AdminUsers', () => ({ default: () => null }));
vi.mock('./pages/ChangePassword', () => ({ default: () => null }));

import App from './App';

describe('authenticated Excel export visibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLocation.mockClear();
    exportWorkbook.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders Export Excel from the authenticated dashboard route', async () => {
    await act(async () => root.render(<App />));

    const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes('Export Excel'));
    expect(button).toBeTruthy();
    expect(setLocation).not.toHaveBeenCalledWith('/login');
  });
});
