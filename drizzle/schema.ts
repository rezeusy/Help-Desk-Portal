import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 100 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Inventory items (master list)
export const inventoryItems = mysqlTable('inventory_items', {
  id: varchar('id', { length: 64 }).primaryKey(), // e.g., 'DSK', 'LAP'
  name: varchar('name', { length: 255 }).notNull(),
  category: mysqlEnum('category', ['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.']).notNull(),
  company: mysqlEnum('company', ['Globalstar', 'Globalynx']),
  totalQty: int('totalQty').notNull().default(0),
  nonWorkingQty: int('nonWorkingQty').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;

// Locations (offices)
export const locations = mysqlTable('locations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

// Location items (deployed quantities)
export const locationItems = mysqlTable('location_items', {
  id: int('id').autoincrement().primaryKey(),
  locationId: varchar('locationId', { length: 64 }).notNull(),
  itemId: varchar('itemId', { length: 64 }).notNull(),
  deployedQty: int('deployedQty').notNull().default(0),
  nonWorkingQty: int('nonWorkingQty').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type LocationItem = typeof locationItems.$inferSelect;
export type InsertLocationItem = typeof locationItems.$inferInsert;

// Immutable audit history for inventory, office, and receipt changes.
// References are intentionally not foreign keys so history survives deletions.
export const auditEvents = mysqlTable('audit_events', {
  id: int('id').autoincrement().primaryKey(),
  action: varchar('action', { length: 64 }).notNull(),
  itemId: varchar('itemId', { length: 64 }),
  itemName: varchar('itemName', { length: 255 }),
  locationId: varchar('locationId', { length: 64 }),
  locationName: varchar('locationName', { length: 255 }),
  quantityDelta: int('quantityDelta'),
  quantityBefore: int('quantityBefore'),
  quantityAfter: int('quantityAfter'),
  actorId: int('actorId'),
  actorName: varchar('actorName', { length: 255 }),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;