// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const state = vi.hoisted(() => ({
  items: [{ id: 'LAP', name: 'Laptop', category: 'Computer', totalQty: 4, deployedQty: 1, notes: null }],
  locations: [{ id: 'HQ', name: 'Headquarters', items: [{ itemId: 'LAP', deployedQty: 1 }] }],
  itemsLoading: false,
  locationsLoading: false,
  exportWorkbook: vi.fn(() => 'it-inventory-summary-2026-08-25.xlsx'),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    reports: { inventoryExport: { useQuery: () => ({ data: { items: state.items, locations: state.locations }, isLoading: state.itemsLoading || state.locationsLoading }) } },
  },
}));
vi.mock('@/lib/inventoryExport', () => ({ exportInventoryWorkbook: state.exportWorkbook }));
vi.mock('sonner', () => ({ toast: state.toast }));

import { InventoryExportButton } from './InventoryExportButton';

describe('InventoryExportButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.itemsLoading = false;
    state.locationsLoading = false;
    state.exportWorkbook.mockClear();
    state.toast.success.mockClear();
    state.toast.error.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('forwards master inventory and every office to the workbook export', async () => {
    await act(async () => root.render(<InventoryExportButton />));
    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Export Excel');

    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(state.exportWorkbook).toHaveBeenCalledWith({ items: state.items, locations: state.locations });
    expect(state.toast.success).toHaveBeenCalledWith('Excel export downloaded: it-inventory-summary-2026-08-25.xlsx');
  });

  it('disables export while either dataset is loading', async () => {
    state.locationsLoading = true;
    await act(async () => root.render(<InventoryExportButton />));

    const button = container.querySelector('button');
    expect((button as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(button?.textContent).toContain('Preparing');
  });
});
