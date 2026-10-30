import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from 'node:crypto';
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, inventoryItems, InsertInventoryItem, locations, InsertLocation, locationItems, auditEvents, InsertAuditEvent } from "../drizzle/schema";
import { ENV } from './_core/env';
import { buildOfficeReceiptAuditEvent } from './audit';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function listManagedUsers() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(users).orderBy(desc(users.createdAt));
  return result.map(({ passwordHash: _passwordHash, ...user }) => user);
}

export async function createLocalUser(input: {
  username: string;
  name: string;
  email?: string | null;
  passwordHash: string;
  role: 'user' | 'admin';
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const openId = `local_${randomUUID().replaceAll('-', '')}`;
  await db.insert(users).values({
    openId,
    username: input.username,
    name: input.name,
    email: input.email || null,
    loginMethod: 'password',
    passwordHash: input.passwordHash,
    role: input.role,
    isActive: true,
  });
  return getUserByOpenId(openId);
}

export async function getManagedUser(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = result[0];
  if (!user) return undefined;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function updateManagedUser(id: number, updates: {
  username?: string;
  name?: string;
  email?: string | null;
  role?: 'user' | 'admin';
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set(updates).where(eq(users.id, id));
  return listManagedUsers();
}

export async function updateManagedUserPassword(id: number, passwordHash: string, mustChangePassword = false) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ passwordHash, loginMethod: 'password', mustChangePassword }).where(eq(users.id, id));
}

export async function countActiveAdmins() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
  return Number(result[0]?.count ?? 0);
}

export async function deleteManagedUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(users).where(eq(users.id, id));
}

export async function markUserSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// ── INVENTORY ITEMS ──────────────────────────────────────────────

export async function listInventoryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryItems);
}

export async function getInventoryItem(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
  return result[0];
}

export async function createInventoryItem(item: InsertInventoryItem) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(inventoryItems).values(item);
  return getInventoryItem(item.id!);
}

export async function updateInventoryItem(id: string, updates: Partial<InsertInventoryItem>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(inventoryItems).set(updates).where(eq(inventoryItems.id, id));
  return getInventoryItem(id);
}

export async function addInventoryStock(id: string, quantity: number, nonWorkingQty = 0) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Stock quantity must be a whole number greater than zero');
  if (!Number.isInteger(nonWorkingQty) || nonWorkingQty < 0 || nonWorkingQty > quantity) {
    throw new Error('Non-working quantity must be between zero and the stock quantity');
  }
  const result = await db
    .update(inventoryItems)
    .set({
      totalQty: sql`${inventoryItems.totalQty} + ${quantity}`,
      nonWorkingQty: sql`${inventoryItems.nonWorkingQty} + ${nonWorkingQty}`,
    })
    .where(eq(inventoryItems.id, id));
  if (result[0]?.affectedRows === 0) throw new Error('Inventory item not found');
  return getInventoryItem(id);
}

export async function updateMasterNonWorkingQty(id: string, nonWorkingQty: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (!Number.isInteger(nonWorkingQty) || nonWorkingQty < 0) throw new Error('Non-working quantity must be a whole number greater than or equal to zero');
  const item = await getInventoryItem(id);
  if (!item) throw new Error('Inventory item not found');
  const deployedQty = await getTotalDeployedQty(id);
  if (nonWorkingQty > item.totalQty - deployedQty) throw new Error('Unassigned non-working quantity cannot exceed stock outside offices');
  await db.update(inventoryItems).set({ nonWorkingQty }).where(eq(inventoryItems.id, id));
  return getInventoryItem(id);
}

export async function deleteInventoryItem(id: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Delete all location items first
  await db.delete(locationItems).where(eq(locationItems.itemId, id));
  // Then delete the item
  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
}

// ── LOCATIONS ────────────────────────────────────────────────────

export async function listLocations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations);
}

export async function getLocation(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return result[0];
}

export async function createLocation(location: InsertLocation) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(locations).values(location);
  return getLocation(location.id!);
}

export async function deleteLocation(id: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  return db.transaction(async (tx) => {
    const assignments = await tx
      .select({ itemId: locationItems.itemId, deployedQty: locationItems.deployedQty })
      .from(locationItems)
      .where(eq(locationItems.locationId, id));

    await tx.delete(locationItems).where(eq(locationItems.locationId, id));
    await tx.delete(locations).where(eq(locations.id, id));

    return assignments;
  });
}

// ── LOCATION ITEMS ───────────────────────────────────────────────

export async function getLocationItems(locationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locationItems).where(eq(locationItems.locationId, locationId));
}

export async function getLocationItem(locationId: string, itemId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(locationItems)
    .where(and(eq(locationItems.locationId, locationId), eq(locationItems.itemId, itemId)))
    .limit(1);
  return result[0];
}

export async function getDeployedQty(locationId: string, itemId: string) {
  const item = await getLocationItem(locationId, itemId);
  return item?.deployedQty ?? 0;
}

export async function updateLocationItem(locationId: string, itemId: string, deployedQty: number, nonWorkingQty?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (!Number.isInteger(deployedQty) || deployedQty < 0) throw new Error('Deployed quantity must be a whole number greater than or equal to zero');
  if (nonWorkingQty !== undefined && (!Number.isInteger(nonWorkingQty) || nonWorkingQty < 0 || nonWorkingQty > deployedQty)) {
    throw new Error('Non-working quantity must be between zero and the deployed quantity');
  }
  
  const existing = await db
    .select()
    .from(locationItems)
    .where(and(eq(locationItems.locationId, locationId), eq(locationItems.itemId, itemId)))
    .limit(1);
  
  if (existing.length > 0) {
    if (deployedQty === 0) {
      // Delete if qty is 0
      await db.delete(locationItems).where(eq(locationItems.id, existing[0].id));
    } else {
      // Update existing
      await db.update(locationItems).set({ deployedQty, ...(nonWorkingQty === undefined ? {} : { nonWorkingQty }) }).where(eq(locationItems.id, existing[0].id));
    }
  } else if (deployedQty > 0) {
    // Create new
      await db.insert(locationItems).values({ locationId, itemId, deployedQty, nonWorkingQty: nonWorkingQty ?? 0 });
  }
}

export async function getTotalDeployedQty(itemId: string) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select()
    .from(locationItems)
    .where(eq(locationItems.itemId, itemId));
  return result.reduce((sum, item) => sum + item.deployedQty, 0);
}

export async function getTotalNonWorkingQty(itemId: string) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ nonWorkingQty: locationItems.nonWorkingQty })
    .from(locationItems)
    .where(eq(locationItems.itemId, itemId));
  return result.reduce((sum, item) => sum + item.nonWorkingQty, 0);
}

export type AddInventoryToLocationInput = {
  locationId: string;
  quantity: number;
  nonWorkingQty?: number;
  itemId?: string;
  actor?: { id?: number; name?: string | null };

  newItem?: {
    id: string;
    name: string;
    category: 'Computer' | 'Accessories' | 'Peripheral' | 'Cables' | 'Misc.';
    company: 'Globalstar' | 'Globalynx';
    notes?: string | null;
  };
};

/**
 * Adds newly received units directly to an office. Existing master items have
 * both totalQty and the office's deployedQty incremented in one transaction.
 * New items are created in the master list with the received quantity before
 * the office assignment is recorded.
 */
type InventoryDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function addInventoryToLocation(input: AddInventoryToLocationInput) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return addInventoryToLocationWithDb(db, input);
}

export async function addInventoryToLocationWithDb(db: InventoryDatabase, input: AddInventoryToLocationInput) {
  const itemId = await db.transaction(async (tx) => {
    const locationResult = await tx
      .select({ name: locations.name })
      .from(locations)
      .where(eq(locations.id, input.locationId))
      .limit(1);
    if (locationResult.length === 0) throw new Error('Office not found');
    const locationName = locationResult[0].name;

    let resolvedItemId = input.itemId;
    let itemName = '';
    let masterTotalBefore = 0;
    let masterTotalAfter = 0;
    const action = input.newItem ? 'office_receipt_new' : 'office_receipt_existing';

    if (input.newItem) {
      const existing = await tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, input.newItem.id))
        .limit(1);
      if (existing.length > 0) {
        throw new Error('This item ID already exists in Master Inventory. Choose it as an existing item.');
      }

      resolvedItemId = input.newItem.id;
      itemName = input.newItem.name;
      masterTotalAfter = input.quantity;
      await tx.insert(inventoryItems).values({
        id: input.newItem.id,
        name: input.newItem.name,
        category: input.newItem.category,
        company: input.newItem.company,
        totalQty: input.quantity,
        notes: input.newItem.notes || null,
      });
    }

    if (!resolvedItemId) {
      throw new Error('An existing Master Inventory item or a new item is required');
    }

    if (!input.newItem) {
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, resolvedItemId))
        .limit(1);
      if (existing.length === 0) {
        throw new Error('Add this item to Master Inventory before assigning it to an office');
      }

      itemName = existing[0].name;
      masterTotalBefore = existing[0].totalQty;
      masterTotalAfter = masterTotalBefore + input.quantity;
      await tx
        .update(inventoryItems)
        .set({ totalQty: sql`${inventoryItems.totalQty} + ${input.quantity}` })
        .where(eq(inventoryItems.id, resolvedItemId));
    }

    const nonWorkingToAdd = input.nonWorkingQty ?? 0;
    if (!Number.isInteger(nonWorkingToAdd) || nonWorkingToAdd < 0 || nonWorkingToAdd > input.quantity) {
      throw new Error('Non-working quantity must be between zero and the received quantity');
    }

    const existingLocationItem = await tx
      .select()
      .from(locationItems)
      .where(and(eq(locationItems.locationId, input.locationId), eq(locationItems.itemId, resolvedItemId)))
      .limit(1);
    const officeQtyBefore = existingLocationItem[0]?.deployedQty ?? 0;
    const officeQtyAfter = officeQtyBefore + input.quantity;
    const nonWorkingBefore = existingLocationItem[0]?.nonWorkingQty ?? 0;
    const nonWorkingAfter = nonWorkingBefore + nonWorkingToAdd;

    if (existingLocationItem.length > 0) {
      await tx
        .update(locationItems)
        .set({ deployedQty: sql`${locationItems.deployedQty} + ${input.quantity}`, nonWorkingQty: sql`${locationItems.nonWorkingQty} + ${nonWorkingToAdd}` })
        .where(eq(locationItems.id, existingLocationItem[0].id));
    } else {
      await tx.insert(locationItems).values({
        locationId: input.locationId,
        itemId: resolvedItemId,
        deployedQty: input.quantity,
        nonWorkingQty: nonWorkingToAdd,
      });
    }

    await tx.insert(auditEvents).values(buildOfficeReceiptAuditEvent({
      action,
      itemId: resolvedItemId,
      itemName,
      locationId: input.locationId,
      locationName,
      quantity: input.quantity,
      officeQtyBefore,
      officeQtyAfter,
      masterTotalBefore,
      masterTotalAfter,
      actor: input.actor,
      nonWorkingBefore,
      nonWorkingAfter,
    }));

    return resolvedItemId;
  });

  const result = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);
  return result[0];
}

export async function createAuditEvent(event: InsertAuditEvent) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(auditEvents).values(event);
  return result;
}

export async function listAuditEvents(input: {
  limit?: number;
  offset?: number;
  action?: string;
  itemId?: string;
  locationId?: string;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const conditions = [];
  if (input.action) conditions.push(eq(auditEvents.action, input.action));
  if (input.itemId) conditions.push(eq(auditEvents.itemId, input.itemId));
  if (input.locationId) conditions.push(eq(auditEvents.locationId, input.locationId));

  const query = db.select().from(auditEvents);
  const filtered = conditions.length ? query.where(and(...conditions)) : query;
  return filtered.orderBy(desc(auditEvents.createdAt)).limit(limit).offset(offset);
}
