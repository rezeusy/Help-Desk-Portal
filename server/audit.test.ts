import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { buildOfficeReceiptAuditEvent } from './audit';

const { listAuditEvents, createInventoryItem, createAuditEvent, addInventoryToLocation, getInventoryItem, updateInventoryItem, updateLocationItem, getLocationItems } = vi.hoisted(() => ({
  listAuditEvents: vi.fn(),
  createInventoryItem: vi.fn(),
  createAuditEvent: vi.fn(),
  addInventoryToLocation: vi.fn(),
  getInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  updateLocationItem: vi.fn(),
  getLocationItems: vi.fn(),
}));

vi.mock('./db', () => ({
  listAuditEvents,
  createInventoryItem,
  createAuditEvent,
  addInventoryToLocation,
  getInventoryItem,
  updateInventoryItem,
  updateLocationItem,
  getLocationItems,
}));

const context: TrpcContext = {
  user: {
    id: 7,
    openId: 'audit-user',
    name: 'Audit User',
    email: 'audit@example.com',
    loginMethod: 'test',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: 'https', headers: {} } as TrpcContext['req'],
  res: {} as TrpcContext['res'],
};

describe('audit history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves filtered audit events with pagination parameters', async () => {
    const events = [{ id: 1, action: 'office_receipt_existing', itemId: 'laptop' }];
    listAuditEvents.mockResolvedValue(events);
    const caller = appRouter.createCaller(context);

    const result = await caller.audit.list({
      limit: 25,
      offset: 10,
      action: 'office_receipt_existing',
      itemId: 'laptop',
      locationId: 'office-a',
    });

    expect(result).toEqual(events);
    expect(listAuditEvents).toHaveBeenCalledWith({
      limit: 25,
      offset: 10,
      action: 'office_receipt_existing',
      itemId: 'laptop',
      locationId: 'office-a',
    });
  });

  it('builds an audit event for an existing-item office receipt', () => {
    expect(buildOfficeReceiptAuditEvent({
      action: 'office_receipt_existing',
      itemId: 'laptop',
      itemName: 'Laptop',
      locationId: 'office-a',
      locationName: 'Office A',
      quantity: 3,
      officeQtyBefore: 2,
      officeQtyAfter: 5,
      masterTotalBefore: 10,
      masterTotalAfter: 13,
      actor: { id: 7, name: 'Audit User' },
    })).toMatchObject({
      action: 'office_receipt_existing',
      itemId: 'laptop',
      locationId: 'office-a',
      quantityDelta: 3,
      quantityBefore: 2,
      quantityAfter: 5,
      actorId: 7,
      actorName: 'Audit User',
    });
  });

  it('builds an audit event for a new-item office receipt', () => {
    expect(buildOfficeReceiptAuditEvent({
      action: 'office_receipt_new',
      itemId: 'dock-01',
      itemName: 'USB-C Dock',
      locationId: 'office-a',
      locationName: 'Office A',
      quantity: 2,
      officeQtyBefore: 0,
      officeQtyAfter: 2,
      masterTotalBefore: 0,
      masterTotalAfter: 2,
      actor: { id: 7, name: 'Audit User' },
    })).toMatchObject({
      action: 'office_receipt_new',
      itemId: 'dock-01',
      quantityDelta: 2,
      quantityBefore: 0,
      quantityAfter: 2,
      actorId: 7,
    });
  });

  it('exercises an existing-item office receipt and persists its audit event', async () => {
    addInventoryToLocation.mockImplementation(async (input) => {
      await createAuditEvent(buildOfficeReceiptAuditEvent({
        action: 'office_receipt_existing',
        itemId: input.itemId,
        itemName: 'Laptop',
        locationId: input.locationId,
        locationName: 'Office A',
        quantity: input.quantity,
        officeQtyBefore: 2,
        officeQtyAfter: 2 + input.quantity,
        masterTotalBefore: 10,
        masterTotalAfter: 10 + input.quantity,
        actor: input.actor,
      }));
      return { id: input.itemId, name: 'Laptop', totalQty: 13 };
    });
    const caller = appRouter.createCaller(context);

    await caller.locationItems.addToLocation({ locationId: 'office-a', itemId: 'laptop', quantity: 3 });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'office_receipt_existing',
      itemId: 'laptop',
      locationId: 'office-a',
      quantityDelta: 3,
      actorId: 7,
      actorName: 'Audit User',
    }));
  });

  it('exercises a new-item office receipt and persists its audit event', async () => {
    addInventoryToLocation.mockImplementation(async (input) => {
      await createAuditEvent(buildOfficeReceiptAuditEvent({
        action: 'office_receipt_new',
        itemId: input.newItem.id,
        itemName: input.newItem.name,
        locationId: input.locationId,
        locationName: 'Office A',
        quantity: input.quantity,
        officeQtyBefore: 0,
        officeQtyAfter: input.quantity,
        masterTotalBefore: 0,
        masterTotalAfter: input.quantity,
        actor: input.actor,
      }));
      return { id: input.newItem.id, name: input.newItem.name, totalQty: input.quantity };
    });
    const caller = appRouter.createCaller(context);

    await caller.locationItems.addToLocation({
      locationId: 'office-a',
      quantity: 2,
      newItem: { id: 'dock-01', name: 'USB-C Dock', category: 'Accessories', company: 'Globalstar' },
    });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'office_receipt_new',
      itemId: 'dock-01',
      locationId: 'office-a',
      quantityDelta: 2,
      quantityBefore: 0,
      quantityAfter: 2,
      actorId: 7,
    }));
  });

  it('records an ownership edit without changing assigned quantities', async () => {
    const before = {
      id: 'mouse-01',
      name: 'Mouse',
      category: 'Accessories',
      company: 'Globalstar',
      totalQty: 5,
      deployedQty: 3,
    };
    const officeAssignments = [{ locationId: 'stanley', itemId: 'mouse-01', deployedQty: 3 }];
    getLocationItems.mockResolvedValue(officeAssignments);
    getInventoryItem.mockResolvedValue(before);
    updateInventoryItem.mockImplementation(async (_id, updates) => ({ ...before, ...updates }));
    const caller = appRouter.createCaller(context);

    const officeAssignmentsBefore = await getLocationItems('stanley');
    const updated = await caller.inventory.update({ id: 'mouse-01', company: 'Globalynx' });
    const officeAssignmentsAfter = await getLocationItems('stanley');

    expect(updated).toMatchObject({ company: 'Globalynx', totalQty: 5, deployedQty: 3 });
    expect(updateInventoryItem).toHaveBeenCalledWith('mouse-01', { company: 'Globalynx' });
    expect(officeAssignmentsAfter).toEqual(officeAssignmentsBefore);
    expect(getLocationItems).toHaveBeenCalledWith('stanley');
    expect(getLocationItems).toHaveBeenCalledTimes(2);
    expect(updateLocationItem).not.toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_updated',
      itemId: 'mouse-01',
      quantityDelta: 0,
      quantityBefore: 5,
      quantityAfter: 5,
      metadata: expect.stringContaining('Globalynx'),
    }));
  });

  it('records the authenticated actor when a master inventory item is created', async () => {
    createInventoryItem.mockResolvedValue({ id: 'mouse-01', name: 'Mouse', totalQty: 5 });
    createAuditEvent.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context);

    await caller.inventory.create({
      id: 'mouse-01',
      name: 'Mouse',
      category: 'Accessories',
      company: 'Globalynx',
      totalQty: 5,
      notes: 'New stock',
    });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'inventory_created',
      itemId: 'mouse-01',
      quantityAfter: 5,
      actorId: 7,
      actorName: 'Audit User',
    }));
  });
});
