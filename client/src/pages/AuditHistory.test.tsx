// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const { auditQuery } = vi.hoisted(() => ({
  auditQuery: vi.fn(),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    audit: {
      list: { useQuery: auditQuery },
    },
  },
}));

import AuditHistory from './AuditHistory';

describe('AuditHistory', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    auditQuery.mockReturnValue({
      data: [{
        id: 1,
        action: 'office_deleted',
        itemId: null,
        itemName: null,
        locationId: 'temp-office',
        locationName: 'Temporary Office',
        quantityDelta: null,
        quantityBefore: null,
        quantityAfter: null,
        actorId: 7,
        actorName: 'Audit User',
        metadata: JSON.stringify({ releasedUnits: 7, releasedItemTypes: 2 }),
        createdAt: new Date('2026-09-01T02:00:00.000Z'),
      }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows returned units for an office deletion event', async () => {
    await act(async () => root.render(<AuditHistory />));

    expect(container.textContent).toContain('Office deleted');
    expect(container.textContent).toContain('+7 returned');
    expect(container.textContent).toContain('Temporary Office');
  });

  it('shows unassigned master-only non-working creation and recovery clearly', async () => {
    auditQuery.mockReturnValue({
      data: [
        {
          id: 3,
          action: 'inventory_stock_received',
          itemId: 'damaged-kbd',
          itemName: 'Damaged Keyboard',
          locationId: null,
          locationName: null,
          quantityDelta: 2,
          quantityBefore: 4,
          quantityAfter: 6,
          actorId: 7,
          actorName: 'Audit User',
          metadata: JSON.stringify({ masterOnly: true, officeAssigned: false, nonWorkingQty: 2 }),
          createdAt: new Date('2026-09-01T02:00:00.000Z'),
        },
        {
          id: 4,
          action: 'master_non_working_update',
          itemId: 'damaged-kbd',
          itemName: 'Damaged Keyboard',
          locationId: null,
          locationName: null,
          quantityDelta: -2,
          quantityBefore: 2,
          quantityAfter: 0,
          actorId: 7,
          actorName: 'Audit User',
          metadata: JSON.stringify({ masterOnly: true, officeAssigned: false }),
          createdAt: new Date('2026-09-01T03:00:00.000Z'),
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await act(async () => root.render(<AuditHistory />));

    expect(container.textContent).toContain('Master stock received');
    expect(container.textContent).toContain('Unassigned');
    expect(container.textContent).toContain('+2 · +2 unassigned non-working');
    expect(container.textContent).toContain('Unassigned condition update');
    expect(container.textContent).toContain('2 → 0 unassigned non-working');
  });

  it('keeps a safe fallback when deletion metadata is malformed', async () => {
    auditQuery.mockReturnValue({
      data: [{
        id: 2,
        action: 'office_deleted',
        itemId: null,
        itemName: null,
        locationId: 'temp-office',
        locationName: 'Temporary Office',
        quantityDelta: null,
        quantityBefore: null,
        quantityAfter: null,
        actorId: 7,
        actorName: 'Audit User',
        metadata: '{not-json',
        createdAt: new Date('2026-09-01T02:00:00.000Z'),
      }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await act(async () => root.render(<AuditHistory />));

    expect(container.textContent).toContain('Office deleted');
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('returned');
  });
});
