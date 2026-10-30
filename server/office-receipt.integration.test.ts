import { describe, expect, it } from 'vitest';
import { inventoryItems, locationItems, locations } from '../drizzle/schema';
import { addInventoryToLocationWithDb } from './db';
import type { AddInventoryToLocationInput } from './db';

type FakeMode = 'existing' | 'new';

function createFakeDatabase(mode: FakeMode) {
  const auditRows: Array<Record<string, unknown>> = [];
  const existingItem = { id: 'laptop', name: 'Laptop', category: 'Computer', totalQty: 10 };
  const newItem = { id: 'dock-01', name: 'USB-C Dock', category: 'Accessories', totalQty: 2 };
  let inventorySelectCount = 0;

  const selectQuery = () => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => {
          if (table === locations) return [{ name: 'Office A' }];
          if (table === locationItems) return [];
          if (table === inventoryItems) {
            inventorySelectCount += 1;
            if (mode === 'new' && inventorySelectCount === 1) return [];
            return [mode === 'existing' ? existingItem : newItem];
          }
          return [];
        },
      }),
    }),
  });

  const transaction = {
    select: selectQuery,
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        if (values.action) auditRows.push(values);
      },
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  };

  const database = {
    transaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction),
    select: selectQuery,
  };

  return { database, auditRows };
}

describe('office receipt transaction audit persistence', () => {
  it('persists an existing-item receipt event with office, actor, and quantity details', async () => {
    const { database, auditRows } = createFakeDatabase('existing');
    const input: AddInventoryToLocationInput = {
      locationId: 'office-a',
      itemId: 'laptop',
      quantity: 3,
      actor: { id: 7, name: 'Audit User' },
    };

    await addInventoryToLocationWithDb(database as never, input);

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: 'office_receipt_existing',
      itemId: 'laptop',
      itemName: 'Laptop',
      locationId: 'office-a',
      locationName: 'Office A',
      quantityDelta: 3,
      quantityBefore: 0,
      quantityAfter: 3,
      actorId: 7,
      actorName: 'Audit User',
    });
  });

  it('persists a new-item receipt event after creating the master item', async () => {
    const { database, auditRows } = createFakeDatabase('new');
    const input: AddInventoryToLocationInput = {
      locationId: 'office-a',
      quantity: 2,
      newItem: {
        id: 'dock-01',
        name: 'USB-C Dock',
        category: 'Accessories',
        company: 'Globalstar',
      },
      actor: { id: 7, name: 'Audit User' },
    };

    await addInventoryToLocationWithDb(database as never, input);

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: 'office_receipt_new',
      itemId: 'dock-01',
      itemName: 'USB-C Dock',
      locationId: 'office-a',
      quantityDelta: 2,
      quantityBefore: 0,
      quantityAfter: 2,
      actorId: 7,
      actorName: 'Audit User',
    });
  });
});
