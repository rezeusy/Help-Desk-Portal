// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const { addMutation, updateMutation, stockMutation, createMutation } = vi.hoisted(() => ({
  addMutation: vi.fn(),
  updateMutation: vi.fn(),
  stockMutation: vi.fn(),
  createMutation: vi.fn(),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    reports: {
      nonWorking: { useQuery: () => ({ data: [], isLoading: false }) },
    },
    locations: {
      list: { useQuery: () => ({ data: [{ id: 'office-1', name: 'Admin', items: [] }] }) },
    },
    inventory: {
      list: { useQuery: () => ({ data: [{ id: 'kbd-1', name: 'Keyboard', category: 'Peripheral', company: 'Globalynx', totalQty: 5, deployedQty: 0, nonWorkingQty: 0 }] }) },
      addStock: { useMutation: () => ({ isPending: false, mutate: stockMutation }) },
      create: { useMutation: () => ({ isPending: false, mutate: createMutation }) },
    },
    locationItems: {
      addToLocation: { useMutation: () => ({ isPending: false, mutate: addMutation }) },
      update: { useMutation: () => ({ isPending: false, mutate: updateMutation }) },
    },
    useUtils: () => ({
      reports: { nonWorking: { invalidate: vi.fn() }, inventoryExport: { invalidate: vi.fn() } },
      inventory: { list: { invalidate: vi.fn() } },
      locations: { list: { invalidate: vi.fn() } },
      stats: { dashboard: { invalidate: vi.fn() } },
    }),
  },
}));

import NonWorkingDevices from './NonWorkingDevices';

describe('NonWorkingDevices direct creation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    addMutation.mockReset();
    updateMutation.mockReset();
    stockMutation.mockReset();
    createMutation.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('opens a direct form and submits an existing asset to the selected office', async () => {
    await act(async () => root.render(<NonWorkingDevices />));

    const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add device'));
    expect(openButton).toBeTruthy();
    await act(async () => openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('Add a non-working device');
    const submitButtons = Array.from(document.body.querySelectorAll('button')).filter((button) => button.textContent?.trim() === 'Add non-working device');
    const submitButton = submitButtons.at(-1);
    expect(submitButton).toBeTruthy();
    await act(async () => submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(addMutation).toHaveBeenCalledWith({
      locationId: 'office-1',
      itemId: 'kbd-1',
      quantity: 1,
      nonWorkingQty: 1,
    });
  });

  it('adds stock to Master Inventory only without selecting an office', async () => {
    await act(async () => root.render(<NonWorkingDevices />));
    const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add device'));
    await act(async () => openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const masterOnlyButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Master Inventory only');
    expect(masterOnlyButton).toBeTruthy();
    await act(async () => masterOnlyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const submitButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Add to Master Inventory');
    expect(submitButton).toBeTruthy();
    await act(async () => submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(stockMutation).toHaveBeenCalledWith({ id: 'kbd-1', quantity: 1, nonWorkingQty: 1 });
    expect(addMutation).not.toHaveBeenCalled();
  });

  it('supports switching to a new asset while retaining company validation fields', async () => {
    await act(async () => root.render(<NonWorkingDevices />));
    const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add device'));
    await act(async () => openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const newButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Create new item');
    expect(newButton).toBeTruthy();
    await act(async () => newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('Asset ID');
    expect(document.body.textContent).toContain('Company');
    expect(document.body.textContent).toContain('Non-working units');
  });
});
