import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

const {
  deleteInventoryItem,
  listInventoryItems,
  getInventoryItem,
  getTotalDeployedQty,
  getTotalNonWorkingQty,
  getLocationItem,
  getDeployedQty,
  updateLocationItem,
  addInventoryToLocation,
  addInventoryStock,
  updateMasterNonWorkingQty,
  getLocation,
  listLocations,
  getLocationItems,
  deleteLocation,
  createAuditEvent,
  listAuditEvents,
} = vi.hoisted(() => ({
  deleteInventoryItem: vi.fn(),
  listInventoryItems: vi.fn(),
  getInventoryItem: vi.fn(),
  getTotalDeployedQty: vi.fn(),
  getTotalNonWorkingQty: vi.fn(),
  getLocationItem: vi.fn(),
  getDeployedQty: vi.fn(),
  updateLocationItem: vi.fn(),
  addInventoryToLocation: vi.fn(),
  addInventoryStock: vi.fn(),
  updateMasterNonWorkingQty: vi.fn(),
  getLocation: vi.fn(),
  listLocations: vi.fn(),
  getLocationItems: vi.fn(),
  deleteLocation: vi.fn(),
  createAuditEvent: vi.fn(),
  listAuditEvents: vi.fn(),
}));

vi.mock('./db', () => ({
  deleteInventoryItem,
  listInventoryItems,
  getInventoryItem,
  getTotalDeployedQty,
  getTotalNonWorkingQty,
  getLocationItem,
  getDeployedQty,
  updateLocationItem,
  addInventoryToLocation,
  addInventoryStock,
  updateMasterNonWorkingQty,
  getLocation,
  listLocations,
  getLocationItems,
  deleteLocation,
  createAuditEvent,
  listAuditEvents,
}));

const context: TrpcContext = {
  user: {
    id: 1,
    openId: 'bulk-test-user',
    name: 'Bulk Test User',
    email: 'bulk@example.com',
    loginMethod: 'test',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: 'https', headers: {} } as TrpcContext['req'],
  res: {} as TrpcContext['res'],
};

describe('bulk inventory actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocation.mockResolvedValue({ id: 'office-a', name: 'Office A' });
    getLocationItem.mockResolvedValue({ deployedQty: 0, nonWorkingQty: 0 });
    getTotalNonWorkingQty.mockResolvedValue(0);
    listLocations.mockResolvedValue([]);
    getLocationItems.mockResolvedValue([]);
    createAuditEvent.mockResolvedValue(undefined);
    listAuditEvents.mockResolvedValue([]);
  });

  it('deletes every selected item and returns the deleted count', async () => {
    deleteInventoryItem.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context);

    const result = await caller.inventory.bulkDelete(['laptop', 'monitor']);

    expect(result).toEqual({ success: true, deletedCount: 2 });
    expect(deleteInventoryItem).toHaveBeenCalledTimes(2);
    expect(deleteInventoryItem).toHaveBeenCalledWith('laptop');
    expect(deleteInventoryItem).toHaveBeenCalledWith('monitor');
  });

  it('increases Master Inventory stock without assigning units to an office', async () => {
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 5 });
    addInventoryStock.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 8, deployedQty: 0 });
    const caller = appRouter.createCaller(context);

    const result = await caller.inventory.addStock({ id: 'laptop', quantity: 3 });

    expect(result).toMatchObject({ id: 'laptop', totalQty: 8 });
    expect(addInventoryStock).toHaveBeenCalledWith('laptop', 3, 0);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_stock_received',
      itemId: 'laptop',
      quantityDelta: 3,
      quantityBefore: 5,
      quantityAfter: 8,
      metadata: expect.stringContaining('"officeAssigned":false'),
    }));
  });

  it('keeps master-only non-working units in inventory but out of working availability', async () => {
    listInventoryItems.mockResolvedValue([
      { id: 'laptop', name: 'Laptop', category: 'Computer', totalQty: 5, nonWorkingQty: 2 },
    ]);
    getTotalDeployedQty.mockResolvedValue(1);
    getTotalNonWorkingQty.mockResolvedValue(1);
    const caller = appRouter.createCaller(context);

    const result = await caller.inventory.list();

    expect(result[0]).toMatchObject({ totalQty: 5, deployedQty: 1, nonWorkingQty: 3, unassignedNonWorkingQty: 2, availableQty: 2 });
  });

  it('adds received units of an existing item to an office and master inventory', async () => {
    addInventoryToLocation.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 8 });
    const caller = appRouter.createCaller(context);

    const result = await caller.locationItems.addToLocation({
      locationId: 'office-a',
      itemId: 'laptop',
      quantity: 3,
    });

    expect(result).toEqual({ id: 'laptop', name: 'Laptop', totalQty: 8 });
    expect(addInventoryToLocation).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'office-a',
      itemId: 'laptop',
      quantity: 3,
      actor: { id: 1, name: 'Bulk Test User' },
    }));
  });

  it('reflects an office-first existing-item addition in master totals and deployed counts', async () => {
    const masterItem = { id: 'laptop', name: 'Laptop', category: 'Computer', totalQty: 5 };
    let deployedAtOffices = 2;
    listInventoryItems.mockImplementation(async () => [masterItem]);
    getTotalDeployedQty.mockImplementation(async () => deployedAtOffices);
    addInventoryToLocation.mockImplementation(async ({ quantity }) => {
      masterItem.totalQty += quantity;
      deployedAtOffices += quantity;
      return masterItem;
    });
    const caller = appRouter.createCaller(context);

    await caller.locationItems.addToLocation({ locationId: 'office-a', itemId: 'laptop', quantity: 3 });
    const masterItems = await caller.inventory.list();

    expect(masterItems[0]).toMatchObject({ totalQty: 8, deployedQty: 5 });
    expect(masterItems[0].totalQty - masterItems[0].deployedQty).toBe(3);
  });

  it('creates a new master item while assigning its initial quantity to an office', async () => {
    addInventoryToLocation.mockResolvedValue({ id: 'dock-01', name: 'USB-C Dock', totalQty: 2 });
    const caller = appRouter.createCaller(context);

    const result = await caller.locationItems.addToLocation({
      locationId: 'office-a',
      quantity: 2,
      newItem: {
        id: 'dock-01',
        name: 'USB-C Dock',
        category: 'Accessories',
        company: 'Globalynx',
        notes: 'Received at office',
      },
    });

    expect(result).toMatchObject({ id: 'dock-01', totalQty: 2 });
    expect(addInventoryToLocation).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'office-a',
      quantity: 2,
      newItem: {
        id: 'dock-01',
        name: 'USB-C Dock',
        category: 'Accessories',
        company: 'Globalynx',
        notes: 'Received at office',
      },
      actor: { id: 1, name: 'Bulk Test User' },
    }));
  });

  it('rejects office additions that provide both an existing and new item', async () => {
    const caller = appRouter.createCaller(context);

    await expect(caller.locationItems.addToLocation({
      locationId: 'office-a',
      itemId: 'laptop',
      quantity: 1,
      newItem: {
        id: 'dock-01',
        name: 'USB-C Dock',
        category: 'Accessories',
        company: 'Globalstar',
      },
    })).rejects.toThrow();
    expect(addInventoryToLocation).not.toHaveBeenCalled();
  });

  it('assigns a Master Inventory item directly to an office', async () => {
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 5 });
    getLocationItem.mockResolvedValue({ deployedQty: 0, nonWorkingQty: 0 });
    getTotalDeployedQty.mockResolvedValue(0);
    updateLocationItem.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context);

    const result = await caller.locationItems.update({
      locationId: 'office-a',
      itemId: 'laptop',
      deployedQty: 2,
    });

    expect(result).toEqual({ success: true });
    expect(updateLocationItem).toHaveBeenCalledWith('office-a', 'laptop', 2, 0);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'office_quantity_update',
      itemId: 'laptop',
      locationId: 'office-a',
      quantityDelta: 2,
      actorId: 1,
      actorName: 'Bulk Test User',
    }));
  });

  it('updates an office assignment’s non-working subset without changing master ownership totals', async () => {
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 5 });
    getLocationItem.mockResolvedValue({ deployedQty: 2, nonWorkingQty: 0 });
    getTotalDeployedQty.mockResolvedValue(2);
    updateLocationItem.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context);

    await caller.locationItems.update({ locationId: 'office-a', itemId: 'laptop', deployedQty: 2, nonWorkingQty: 1 });

    expect(updateLocationItem).toHaveBeenCalledWith('office-a', 'laptop', 2, 1);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'office_quantity_update',
      quantityDelta: 0,
      metadata: expect.stringContaining('"nonWorkingAfter":1'),
    }));
  });

  it('rejects a non-working quantity greater than the office assignment', async () => {
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 5 });
    getLocationItem.mockResolvedValue({ deployedQty: 2, nonWorkingQty: 0 });
    getTotalDeployedQty.mockResolvedValue(2);
    const caller = appRouter.createCaller(context);

    await expect(caller.locationItems.update({ locationId: 'office-a', itemId: 'laptop', deployedQty: 2, nonWorkingQty: 3 })).rejects.toThrow('Non-working quantity cannot exceed the office quantity');
    expect(updateLocationItem).not.toHaveBeenCalled();
  });

  it('reflects a direct office assignment in master deployed and available totals', async () => {
    let officeQuantity = 0;
    listInventoryItems.mockResolvedValue([
      { id: 'laptop', name: 'Laptop', category: 'Computer', totalQty: 5 },
    ]);
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 5 });
    getLocationItem.mockImplementation(async () => ({ deployedQty: officeQuantity, nonWorkingQty: 0 }));
    getTotalDeployedQty.mockImplementation(async () => officeQuantity);
    updateLocationItem.mockImplementation(async (_locationId, _itemId, quantity) => {
      officeQuantity = quantity;
    });
    const caller = appRouter.createCaller(context);

    await caller.locationItems.update({ locationId: 'office-a', itemId: 'laptop', deployedQty: 2 });
    const masterItems = await caller.inventory.list();

    expect(masterItems[0]).toMatchObject({ id: 'laptop', deployedQty: 2, totalQty: 5 });
    expect(masterItems[0].totalQty - masterItems[0].deployedQty).toBe(3);
  });

  it('reflects office deletion in deployed and available master totals while preserving owned quantity', async () => {
    const masterItem = { id: 'keyboard', name: 'Keyboard', category: 'Accessories', totalQty: 47 };
    let officeAssignments = [{ itemId: 'keyboard', deployedQty: 44 }];
    listInventoryItems.mockResolvedValue([masterItem]);
    getTotalDeployedQty.mockImplementation(async () => officeAssignments.reduce((sum, assignment) => sum + assignment.deployedQty, 0));
    getLocation.mockResolvedValue({ id: 'office-a', name: 'Office A' });
    deleteLocation.mockImplementation(async () => {
      const removed = officeAssignments;
      officeAssignments = [];
      return removed;
    });
    const caller = appRouter.createCaller(context);

    const before = await caller.inventory.list();
    const deleted = await caller.locations.delete('office-a');
    const after = await caller.inventory.list();

    expect(before[0]).toMatchObject({ totalQty: 47, deployedQty: 44 });
    expect(after[0]).toMatchObject({ totalQty: 47, deployedQty: 0 });
    expect(after[0].totalQty - after[0].deployedQty).toBe(47);
    expect(deleted).toEqual({ success: true, releasedUnits: 44, releasedItemTypes: 1 });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'office_deleted',
      locationId: 'office-a',
      metadata: expect.stringContaining('"releasedUnits":44'),
    }));
  });

  it('lists non-working assignments with master item and office context', async () => {
    listInventoryItems.mockResolvedValue([
      { id: 'laptop', name: 'Laptop', category: 'Computer', company: 'Globalstar', totalQty: 5 },
      { id: 'monitor', name: 'Monitor', category: 'Peripheral', company: 'Globalynx', totalQty: 3 },
    ]);
    listLocations.mockResolvedValue([{ id: 'office-a', name: 'Office A' }, { id: 'office-b', name: 'Office B' }]);
    getLocationItems.mockImplementation(async (locationId) => locationId === 'office-a'
      ? [{ itemId: 'laptop', deployedQty: 2, nonWorkingQty: 1 }]
      : [{ itemId: 'monitor', deployedQty: 1, nonWorkingQty: 0 }]);
    const caller = appRouter.createCaller(context);

    const result = await caller.reports.nonWorking();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ item: { id: 'laptop' }, location: { id: 'office-a' }, deployedQty: 2, nonWorkingQty: 1 });
  });

  it('lists unassigned master non-working stock and supports marking it working', async () => {
    listInventoryItems.mockResolvedValue([
      { id: 'damaged-kbd', name: 'Damaged Keyboard', category: 'Peripheral', company: 'Globalstar', totalQty: 4, nonWorkingQty: 2 },
    ]);
    listLocations.mockResolvedValue([]);
    getInventoryItem.mockResolvedValue({ id: 'damaged-kbd', name: 'Damaged Keyboard', totalQty: 4, nonWorkingQty: 2 });
    updateMasterNonWorkingQty.mockResolvedValue({ id: 'damaged-kbd', name: 'Damaged Keyboard', totalQty: 4, nonWorkingQty: 0 });
    const caller = appRouter.createCaller(context);

    const report = await caller.reports.nonWorking();
    expect(report).toMatchObject([{ item: { id: 'damaged-kbd' }, location: null, deployedQty: 0, nonWorkingQty: 2 }]);

    const recovered = await caller.inventory.updateMasterNonWorking({ id: 'damaged-kbd', nonWorkingQty: 0 });
    expect(recovered).toMatchObject({ id: 'damaged-kbd', nonWorkingQty: 0 });
    expect(updateMasterNonWorkingQty).toHaveBeenCalledWith('damaged-kbd', 0);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'master_non_working_update',
      quantityDelta: -2,
      quantityBefore: 2,
      quantityAfter: 0,
      metadata: expect.stringContaining('"masterOnly":true'),
    }));
  });

  it('rejects direct office assignment for an item absent from Master Inventory', async () => {
    getInventoryItem.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context);

    await expect(
      caller.locationItems.update({ locationId: 'office-a', itemId: 'unknown', deployedQty: 1 }),
    ).rejects.toThrow('Add this item to Master Inventory before assigning it to an office');
    expect(updateLocationItem).not.toHaveBeenCalled();
  });

  it('rejects direct office assignment when available stock is insufficient', async () => {
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 2 });
    getDeployedQty.mockResolvedValue(0);
    getTotalDeployedQty.mockResolvedValue(2);
    const caller = appRouter.createCaller(context);

    await expect(
      caller.locationItems.update({ locationId: 'office-a', itemId: 'laptop', deployedQty: 1 }),
    ).rejects.toThrow('Not enough available stock for Laptop');
    expect(updateLocationItem).not.toHaveBeenCalled();
  });

  it('deploys the requested quantity for every selected item', async () => {
    getInventoryItem
      .mockResolvedValueOnce({ id: 'laptop', name: 'Laptop', totalQty: 5 })
      .mockResolvedValueOnce({ id: 'monitor', name: 'Monitor', totalQty: 4 });
    getDeployedQty.mockResolvedValue(0);
    getTotalDeployedQty.mockReturnValue(0);
    updateLocationItem.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context);

    const result = await caller.locationItems.bulkDeploy({
      locationId: 'office-a',
      itemIds: ['laptop', 'monitor'],
      deployedQty: 2,
    });

    expect(result).toEqual({ success: true, deployedCount: 2 });
    expect(updateLocationItem).toHaveBeenCalledWith('office-a', 'laptop', 2);
    expect(updateLocationItem).toHaveBeenCalledWith('office-a', 'monitor', 2);
  });

  it('rejects bulk deployment when an item has insufficient available stock', async () => {
    getInventoryItem.mockResolvedValue({ id: 'laptop', name: 'Laptop', totalQty: 3 });
    getDeployedQty.mockResolvedValue(1);
    getTotalDeployedQty.mockResolvedValue(3);
    const caller = appRouter.createCaller(context);

    await expect(
      caller.locationItems.bulkDeploy({
        locationId: 'office-a',
        itemIds: ['laptop'],
        deployedQty: 2,
      }),
    ).rejects.toThrow('Not enough available stock for Laptop');

    expect(updateLocationItem).not.toHaveBeenCalled();
  });
});
