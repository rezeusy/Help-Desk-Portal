import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { getSessionCookieOptions } from './_core/cookies';
import { systemRouter } from './_core/systemRouter';
import { adminProcedure, protectedProcedure, publicProcedure, router } from './_core/trpc';
import { sdk } from './_core/sdk';
import { generateTemporaryPassword, hashPassword, verifyPassword } from './_core/localAuth';

const auditActor = (ctx: { user: { id: number; name: string | null; email: string | null } }) => ({
  actorId: ctx.user?.id,
  actorName: ctx.user?.name || ctx.user?.email || 'Unknown user',
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { getUserByUsername, markUserSignedIn } = await import('./db');
        const user = await getUserByUsername(input.username.trim().toLowerCase());
        if (!user?.passwordHash || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password' });
        }

        const token = await sdk.createSessionToken(user.openId, {
          name: user.name || user.username || 'IT Personnel',
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        await markUserSignedIn(user.id);
        const { passwordHash: _passwordHash, ...safeUser } = user;
        return { success: true, user: safeUser, mustChangePassword: user.mustChangePassword } as const;
      }),
    changePassword: protectedProcedure
      .input(z.object({ password: z.string().min(8).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const { updateManagedUserPassword, createAuditEvent } = await import('./db');
        await updateManagedUserPassword(ctx.user.id, await hashPassword(input.password), false);
        await createAuditEvent({
          action: 'user_password_changed',
          actorId: ctx.user.id,
          actorName: ctx.user.name || ctx.user.email || 'Unknown user',
          metadata: JSON.stringify({ userId: ctx.user.id, username: ctx.user.username, forcedResetCompleted: true }),
        });
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  admin: router({
    users: router({
      list: adminProcedure.query(async () => {
        const { listManagedUsers } = await import('./db');
        return listManagedUsers();
      }),
      create: adminProcedure
        .input(z.object({
          username: z.string().trim().toLowerCase().min(3).max(100).regex(/^[a-z0-9._-]+$/),
          name: z.string().trim().min(1).max(255),
          email: z.string().trim().email().optional().or(z.literal('')),
          password: z.string().min(8).max(128),
          role: z.enum(['user', 'admin']).default('user'),
        }))
        .mutation(async ({ input, ctx }) => {
          const { createLocalUser, createAuditEvent } = await import('./db');
          const created = await createLocalUser({
            username: input.username,
            name: input.name,
            email: input.email || null,
            passwordHash: await hashPassword(input.password),
            role: input.role,
          });
          if (!created) throw new Error('User could not be created');
          const { passwordHash: _passwordHash, ...safeUser } = created;
          await createAuditEvent({
            action: 'user_created',
            actorId: ctx.user.id,
            actorName: ctx.user.name || ctx.user.email || 'Unknown user',
            metadata: JSON.stringify({ userId: created.id, username: created.username, role: created.role }),
          });
          return safeUser;
        }),
      update: adminProcedure
        .input(z.object({
          id: z.number().int().positive(),
          username: z.string().trim().toLowerCase().min(3).max(100).regex(/^[a-z0-9._-]+$/).optional(),
          name: z.string().trim().min(1).max(255).optional(),
          email: z.string().trim().email().optional().or(z.literal('')),
          role: z.enum(['user', 'admin']).optional(),
          isActive: z.boolean().optional(),
        }).refine((input) => Object.keys(input).some((key) => key !== 'id' && input[key as keyof typeof input] !== undefined), { message: 'At least one user field is required' }))
        .mutation(async ({ input, ctx }) => {
          const { getManagedUser, updateManagedUser, countActiveAdmins, createAuditEvent } = await import('./db');
          const before = await getManagedUser(input.id);
          if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
          if (input.id === ctx.user.id && input.isActive === false) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot deactivate your own account' });
          }
          if (input.id === ctx.user.id && input.role === 'user') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot remove your own admin access' });
          }
          if (before.role === 'admin' && before.isActive && (input.role === 'user' || input.isActive === false) && await countActiveAdmins() <= 1) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one active administrator must remain' });
          }
          const { id, email, ...rest } = input;
          const updates = { ...rest, ...(email !== undefined ? { email: email || null } : {}) };
          const users = await updateManagedUser(id, updates);
          await createAuditEvent({
            action: 'user_updated',
            actorId: ctx.user.id,
            actorName: ctx.user.name || ctx.user.email || 'Unknown user',
            metadata: JSON.stringify({ userId: id, before: { username: before.username, name: before.name, email: before.email, role: before.role, isActive: before.isActive }, updates }),
          });
          return users;
        }),
      changePassword: adminProcedure
        .input(z.object({ id: z.number().int().positive(), password: z.string().min(8).max(128) }))
        .mutation(async ({ input, ctx }) => {
          const { getManagedUser, updateManagedUserPassword, createAuditEvent } = await import('./db');
          const target = await getManagedUser(input.id);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
          await updateManagedUserPassword(input.id, await hashPassword(input.password));
          await createAuditEvent({
            action: 'user_password_changed',
            actorId: ctx.user.id,
            actorName: ctx.user.name || ctx.user.email || 'Unknown user',
            metadata: JSON.stringify({ userId: input.id, username: target.username }),
          });
          return { success: true } as const;
        }),
      resetPassword: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const { getManagedUser, updateManagedUserPassword, createAuditEvent } = await import('./db');
          const target = await getManagedUser(input.id);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
          const temporaryPassword = generateTemporaryPassword();
          await updateManagedUserPassword(input.id, await hashPassword(temporaryPassword), true);
          await createAuditEvent({
            action: 'user_password_reset',
            actorId: ctx.user.id,
            actorName: ctx.user.name || ctx.user.email || 'Unknown user',
            metadata: JSON.stringify({ userId: input.id, username: target.username }),
          });
          return { temporaryPassword };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const { getManagedUser, countActiveAdmins, deleteManagedUser, createAuditEvent } = await import('./db');
          const target = await getManagedUser(input.id);
          if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
          if (input.id === ctx.user.id) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot delete your own account' });
          }
          if (target.role === 'admin' && target.isActive && await countActiveAdmins() <= 1) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one active administrator must remain' });
          }
          await deleteManagedUser(input.id);
          await createAuditEvent({
            action: 'user_deleted',
            actorId: ctx.user.id,
            actorName: ctx.user.name || ctx.user.email || 'Unknown user',
            metadata: JSON.stringify({ userId: input.id, username: target.username, role: target.role }),
          });
          return { success: true } as const;
        }),
    }),
  }),

  inventory: router({
    list: publicProcedure.query(async () => {
      const { listInventoryItems, getTotalDeployedQty, getTotalNonWorkingQty } = await import('./db');
      const items = await listInventoryItems();
      return Promise.all(items.map(async (item) => {
        const deployedQty = await getTotalDeployedQty(item.id);
        const assignedNonWorkingQty = await getTotalNonWorkingQty(item.id);
        const unassignedNonWorkingQty = item.nonWorkingQty ?? 0;
        return {
          ...item,
          deployedQty,
          nonWorkingQty: unassignedNonWorkingQty + assignedNonWorkingQty,
          unassignedNonWorkingQty,
          availableQty: Math.max(0, item.totalQty - deployedQty - unassignedNonWorkingQty),
        };
      }));
    }),
    create: protectedProcedure
      .input(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        category: z.enum(['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.']),
        company: z.enum(['Globalstar', 'Globalynx']),
        totalQty: z.number().int().min(0),
        nonWorkingQty: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      }).refine((input) => (input.nonWorkingQty ?? 0) <= input.totalQty, {
        message: 'Non-working quantity cannot exceed total inventory quantity',
      }))
      .mutation(async ({ input, ctx }) => {
        const { createInventoryItem, createAuditEvent } = await import('./db');
        const created = await createInventoryItem({
          id: input.id,
          name: input.name,
          category: input.category,
          company: input.company,
          totalQty: input.totalQty,
          nonWorkingQty: input.nonWorkingQty ?? 0,
          notes: input.notes || null,
        });
        await createAuditEvent({
          action: 'inventory_created',
          itemId: input.id,
          itemName: input.name,
          quantityAfter: input.totalQty,
          metadata: JSON.stringify({ category: input.category, company: input.company, notes: input.notes || null, nonWorkingQty: input.nonWorkingQty ?? 0, officeAssigned: false, masterOnly: true }),
          ...auditActor(ctx),
        });
        return created;
      }),
    addStock: protectedProcedure
      .input(z.object({ id: z.string().min(1), quantity: z.number().int().min(1), nonWorkingQty: z.number().int().min(0).optional() }).refine((input) => (input.nonWorkingQty ?? 0) <= input.quantity, {
        message: 'Non-working quantity cannot exceed the stock quantity',
      }))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, addInventoryStock, createAuditEvent } = await import('./db');
        const before = await getInventoryItem(input.id);
        if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
        const nonWorkingQty = input.nonWorkingQty ?? 0;
        const updated = await addInventoryStock(input.id, input.quantity, nonWorkingQty);
        await createAuditEvent({
          action: 'inventory_stock_received',
          itemId: input.id,
          itemName: before.name,
          quantityDelta: input.quantity,
          quantityBefore: before.totalQty,
          quantityAfter: updated?.totalQty ?? before.totalQty + input.quantity,
          metadata: JSON.stringify({ masterOnly: true, officeAssigned: false, nonWorkingQty, unassignedNonWorkingAfter: updated?.nonWorkingQty ?? before.nonWorkingQty + nonWorkingQty }),
          ...auditActor(ctx),
        });
        return updated;
      }),
    updateMasterNonWorking: protectedProcedure
      .input(z.object({ id: z.string().min(1), nonWorkingQty: z.number().int().min(0) }))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, getTotalDeployedQty, updateMasterNonWorkingQty, createAuditEvent } = await import('./db');
        const before = await getInventoryItem(input.id);
        if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
        const deployedQty = (await getTotalDeployedQty(input.id)) ?? 0;
        if (input.nonWorkingQty > before.totalQty - deployedQty) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unassigned non-working quantity cannot exceed stock outside offices' });
        const updated = await updateMasterNonWorkingQty(input.id, input.nonWorkingQty);
        await createAuditEvent({
          action: 'master_non_working_update',
          itemId: input.id,
          itemName: before.name,
          quantityDelta: input.nonWorkingQty - before.nonWorkingQty,
          quantityBefore: before.nonWorkingQty,
          quantityAfter: input.nonWorkingQty,
          metadata: JSON.stringify({ officeAssigned: false, masterOnly: true }),
          ...auditActor(ctx),
        });
        return updated;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        category: z.enum(['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.']).optional(),
        company: z.enum(['Globalstar', 'Globalynx']).optional(),
        totalQty: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, updateInventoryItem, createAuditEvent } = await import('./db');
        const before = await getInventoryItem(input.id);
        if (!before) throw new Error('Inventory item not found');
        const { id, ...updates } = input;
        const updated = await updateInventoryItem(id, updates);
        await createAuditEvent({
          action: 'inventory_updated',
          itemId: id,
          itemName: updated?.name || before.name,
          quantityDelta: input.totalQty === undefined ? 0 : input.totalQty - before.totalQty,
          quantityBefore: before.totalQty,
          quantityAfter: updated?.totalQty ?? input.totalQty ?? before.totalQty,
          metadata: JSON.stringify({ updates }),
          ...auditActor(ctx),
        });
        return updated;
      }),
    delete: protectedProcedure
      .input(z.string().min(1))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, deleteInventoryItem, createAuditEvent } = await import('./db');
        const before = await getInventoryItem(input);
        await deleteInventoryItem(input);
        await createAuditEvent({
          action: 'inventory_deleted',
          itemId: input,
          itemName: before?.name,
          quantityBefore: before?.totalQty,
          metadata: JSON.stringify({ removedFromAllOffices: true }),
          ...auditActor(ctx),
        });
        return { success: true };
      }),
    bulkDelete: protectedProcedure
      .input(z.array(z.string().min(1)).min(1))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, deleteInventoryItem, createAuditEvent } = await import('./db');
        await Promise.all(input.map(async (itemId) => {
          const before = await getInventoryItem(itemId);
          await deleteInventoryItem(itemId);
          await createAuditEvent({
            action: 'inventory_deleted',
            itemId,
            itemName: before?.name,
            quantityBefore: before?.totalQty,
            metadata: JSON.stringify({ bulk: true, removedFromAllOffices: true }),
            ...auditActor(ctx),
          });
        }));
        return { success: true, deletedCount: input.length };
      }),
  }),

  locations: router({
    list: publicProcedure.query(async () => {
      const { listLocations, getLocationItems } = await import('./db');
      const locs = await listLocations();
      return Promise.all(locs.map(async (loc) => ({
        ...loc,
        items: await getLocationItems(loc.id),
      })));
    }),
    create: protectedProcedure
      .input(z.object({ id: z.string().min(1), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { createLocation, createAuditEvent } = await import('./db');
        const created = await createLocation(input);
        await createAuditEvent({
          action: 'office_created',
          locationId: input.id,
          locationName: input.name,
          metadata: JSON.stringify({}),
          ...auditActor(ctx),
        });
        return created;
      }),
    delete: protectedProcedure
      .input(z.string().min(1))
      .mutation(async ({ input, ctx }) => {
        const { getLocation, deleteLocation, createAuditEvent } = await import('./db');
        const before = await getLocation(input);
        const releasedItems = await deleteLocation(input);
        const releasedUnits = releasedItems.reduce((sum, item) => sum + item.deployedQty, 0);
        await createAuditEvent({
          action: 'office_deleted',
          locationId: input,
          locationName: before?.name,
          metadata: JSON.stringify({
            unassignedAllItems: true,
            releasedUnits,
            releasedItemTypes: releasedItems.length,
            releasedItems,
          }),
          ...auditActor(ctx),
        });
        return { success: true, releasedUnits, releasedItemTypes: releasedItems.length };
      }),
  }),

  reports: router({
    inventoryExport: protectedProcedure.query(async () => {
      const { listInventoryItems, getTotalDeployedQty, getTotalNonWorkingQty, listLocations, getLocationItems } = await import('./db');
      const [inventoryItems, officeRows] = await Promise.all([listInventoryItems(), listLocations()]);
      const items = await Promise.all(inventoryItems.map(async (item) => {
        const deployedQty = await getTotalDeployedQty(item.id);
        const assignedNonWorkingQty = await getTotalNonWorkingQty(item.id);
        const unassignedNonWorkingQty = item.nonWorkingQty ?? 0;
        return {
          ...item,
          deployedQty,
          nonWorkingQty: unassignedNonWorkingQty + assignedNonWorkingQty,
          unassignedNonWorkingQty,
          availableQty: Math.max(0, item.totalQty - deployedQty - unassignedNonWorkingQty),
        };
      }));
      const locations = await Promise.all(officeRows.map(async (location) => ({
        ...location,
        items: await getLocationItems(location.id),
      })));
      return { items, locations };
    }),
    nonWorking: protectedProcedure.query(async () => {
      const { listInventoryItems, listLocations, getLocationItems } = await import('./db');
      const [items, offices] = await Promise.all([listInventoryItems(), listLocations()]);
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const rows = [] as Array<{ item: typeof items[number]; location: typeof offices[number] | null; deployedQty: number; nonWorkingQty: number }>;
      for (const item of items) {
        if ((item.nonWorkingQty ?? 0) > 0) rows.push({ item, location: null, deployedQty: 0, nonWorkingQty: item.nonWorkingQty ?? 0 });
      }
      for (const office of offices) {
        const assignments = await getLocationItems(office.id);
        for (const assignment of assignments) {
          if (assignment.nonWorkingQty > 0) {
            const item = itemMap.get(assignment.itemId);
            if (item) rows.push({ item, location: office, deployedQty: assignment.deployedQty, nonWorkingQty: assignment.nonWorkingQty });
          }
        }
      }
      return rows;
    }),
  }),

  locationItems: router({
    update: protectedProcedure
      .input(z.object({
        locationId: z.string().min(1),
        itemId: z.string().min(1),
        deployedQty: z.number().int().min(0),
        nonWorkingQty: z.number().int().min(0).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, getLocation, getTotalDeployedQty, getLocationItem, updateLocationItem, createAuditEvent } = await import('./db');
        const item = await getInventoryItem(input.itemId);
        if (!item) throw new Error('Add this item to Master Inventory before assigning it to an office');
        const location = await getLocation(input.locationId);
        if (!location) throw new Error('Office not found');

        const currentLocationItem = await getLocationItem(input.locationId, input.itemId);
        const currentAtLocation = currentLocationItem?.deployedQty ?? 0;
        const currentNonWorking = currentLocationItem?.nonWorkingQty ?? 0;
        const nextNonWorking = input.nonWorkingQty ?? currentNonWorking;
        if (nextNonWorking > input.deployedQty) throw new Error('Non-working quantity cannot exceed the office quantity');
        const totalDeployed = await getTotalDeployedQty(input.itemId);
        const availableAcrossLocations = item.totalQty - totalDeployed - (item.nonWorkingQty ?? 0);
        const additionalRequired = Math.max(0, input.deployedQty - currentAtLocation);
        if (additionalRequired > availableAcrossLocations) {
          throw new Error(`Not enough available stock for ${item.name}`);
        }

        await updateLocationItem(input.locationId, input.itemId, input.deployedQty, nextNonWorking);
        await createAuditEvent({
          action: input.deployedQty >= currentAtLocation ? 'office_quantity_update' : 'office_unassign',
          itemId: input.itemId,
          itemName: item.name,
          locationId: input.locationId,
          locationName: location.name,
          quantityDelta: input.deployedQty - currentAtLocation,
          quantityBefore: currentAtLocation,
          quantityAfter: input.deployedQty,
          metadata: JSON.stringify({ masterTotal: item.totalQty, nonWorkingBefore: currentNonWorking, nonWorkingAfter: nextNonWorking }),
          ...auditActor(ctx),
        });
        return { success: true };
      }),
    addToLocation: protectedProcedure
      .input(z.object({
        locationId: z.string().min(1),
        quantity: z.number().int().min(1),
        nonWorkingQty: z.number().int().min(0).optional(),
        itemId: z.string().min(1).optional(),
        newItem: z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          category: z.enum(['Computer', 'Accessories', 'Peripheral', 'Cables', 'Misc.']),
          company: z.enum(['Globalstar', 'Globalynx']),
          notes: z.string().optional(),
        }).optional(),
      }).refine((input) => Boolean(input.itemId) !== Boolean(input.newItem), {
        message: 'Choose an existing item or enter a new item, but not both',
      }))
      .mutation(async ({ input, ctx }) => {
        const { addInventoryToLocation } = await import('./db');
        return addInventoryToLocation({ ...input, actor: { id: ctx.user.id, name: ctx.user.name || ctx.user.email } });
      }),
    bulkDeploy: protectedProcedure
      .input(z.object({
        locationId: z.string().min(1),
        itemIds: z.array(z.string().min(1)).min(1),
        deployedQty: z.number().int().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getInventoryItem, getLocation, getTotalDeployedQty, getDeployedQty, updateLocationItem, createAuditEvent } = await import('./db');
        const location = await getLocation(input.locationId);
        if (!location) throw new Error('Office not found');

        const validatedItems = [] as Array<{ id: string; name: string; currentAtLocation: number; totalQty: number }>;
        for (const itemId of input.itemIds) {
          const item = await getInventoryItem(itemId);
          if (!item) throw new Error(`Inventory item ${itemId} was not found`);
          const currentAtLocation = await getDeployedQty(input.locationId, itemId);
          const totalDeployed = await getTotalDeployedQty(itemId);
          const availableAcrossLocations = item.totalQty - totalDeployed - (item.nonWorkingQty ?? 0);
          const additionalRequired = Math.max(0, input.deployedQty - currentAtLocation);
          if (additionalRequired > availableAcrossLocations) throw new Error(`Not enough available stock for ${item.name}`);
          validatedItems.push({ id: itemId, name: item.name, currentAtLocation, totalQty: item.totalQty });
        }

        await Promise.all(input.itemIds.map((itemId) => updateLocationItem(input.locationId, itemId, input.deployedQty)));
        await Promise.all(validatedItems.map((item) => createAuditEvent({
          action: 'bulk_deploy',
          itemId: item.id,
          itemName: item.name,
          locationId: input.locationId,
          locationName: location.name,
          quantityDelta: input.deployedQty - item.currentAtLocation,
          quantityBefore: item.currentAtLocation,
          quantityAfter: input.deployedQty,
          metadata: JSON.stringify({ bulk: true, masterTotal: item.totalQty }),
          ...auditActor(ctx),
        })));
        return { success: true, deployedCount: input.itemIds.length };
      }),
  }),

  audit: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        action: z.string().optional(),
        itemId: z.string().optional(),
        locationId: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { listAuditEvents } = await import('./db');
        return listAuditEvents(input || {});
      }),
  }),

  stats: router({
    dashboard: publicProcedure.query(async () => {
      const { listInventoryItems, getTotalDeployedQty, listLocations, getLocationItems } = await import('./db');
      const items = await listInventoryItems();
      const locs = await listLocations();
      const totalQty = items.reduce((sum, item) => sum + item.totalQty, 0);
      const deployedQty = await Promise.all(items.map((item) => getTotalDeployedQty(item.id))).then((qtys) => qtys.reduce((sum, q) => sum + q, 0));
      const unassignedNonWorkingQty = items.reduce((sum, item) => sum + (item.nonWorkingQty ?? 0), 0);
      const availableQty = Math.max(0, totalQty - deployedQty - unassignedNonWorkingQty);
      const byCategory: Record<string, { types: number; units: number }> = {};
      items.forEach((item) => {
        if (!byCategory[item.category]) byCategory[item.category] = { types: 0, units: 0 };
        byCategory[item.category].types++;
        byCategory[item.category].units += item.totalQty;
      });
      const locationsSummary = await Promise.all(locs.map(async (loc) => {
        const locItems = await getLocationItems(loc.id);
        const deployed = locItems.reduce((sum, li) => sum + li.deployedQty, 0);
        const itemCount = locItems.filter((li) => li.deployedQty > 0).length;
        return { ...loc, deployed, itemCount };
      }));
      return { totalItems: items.length, totalQty, deployedQty, availableQty, byCategory, locations: locationsSummary };
    }),
  }),
});

export type AppRouter = typeof appRouter;
