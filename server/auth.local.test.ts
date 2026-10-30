import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from './routers';
import { hashPassword, verifyPassword } from './_core/localAuth';
import type { TrpcContext } from './_core/context';

const { getUserByUsername, markUserSignedIn, createLocalUser, listManagedUsers, getManagedUser, updateManagedUser, updateManagedUserPassword, countActiveAdmins, deleteManagedUser, createAuditEvent } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  markUserSignedIn: vi.fn(),
  createLocalUser: vi.fn(),
  listManagedUsers: vi.fn(),
  getManagedUser: vi.fn(),
  updateManagedUser: vi.fn(),
  updateManagedUserPassword: vi.fn(),
  countActiveAdmins: vi.fn(),
  deleteManagedUser: vi.fn(),
  createAuditEvent: vi.fn(),
}));

vi.mock('./db', () => ({
  getUserByUsername,
  markUserSignedIn,
  createLocalUser,
  listManagedUsers,
  updateManagedUser,
  updateManagedUserPassword,
  countActiveAdmins,
  deleteManagedUser,
  getManagedUser,
  createAuditEvent,
}));

function createContext(role: 'user' | 'admin' = 'admin') {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const context: TrpcContext = {
    user: {
      id: role === 'admin' ? 1 : 2,
      openId: `${role}-user`,
      name: role === 'admin' ? 'Admin User' : 'IT User',
      email: `${role}@example.com`,
      loginMethod: 'password',
      role,
      username: role === 'admin' ? 'admin' : 'it-user',
      passwordHash: null,
      mustChangePassword: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
  return { context, cookies };
}

describe('local personnel authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in an active local user and sets the signed session cookie', async () => {
    const passwordHash = await hashPassword('correct-password');
    getUserByUsername.mockResolvedValue({
      id: 3,
      openId: 'local_personnel',
      username: 'alex.it',
      name: 'Alex IT',
      email: 'alex@example.com',
      loginMethod: 'password',
      passwordHash,
      isActive: true,
      role: 'user',
    });
    markUserSignedIn.mockResolvedValue(undefined);
    const { context, cookies } = createContext();
    const caller = appRouter.createCaller(context);

    const result = await caller.auth.login({ username: ' Alex.IT ', password: 'correct-password' });

    expect(result.success).toBe(true);
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('app_session_id');
    expect(markUserSignedIn).toHaveBeenCalledWith(3);
    expect(await verifyPassword('correct-password', passwordHash)).toBe(true);
  });

  it('rejects inactive or invalid local credentials', async () => {
    getUserByUsername.mockResolvedValue({ username: 'alex.it', passwordHash: await hashPassword('correct-password'), isActive: false });
    const { context } = createContext();
    const caller = appRouter.createCaller(context);

    await expect(caller.auth.login({ username: 'alex.it', password: 'correct-password' })).rejects.toThrow('Invalid username or password');
  });

  it('exposes mustChangePassword through auth.me after session restoration', async () => {
    const { context } = createContext('user');
    context.user!.mustChangePassword = true;
    const caller = appRouter.createCaller(context);

    await expect(caller.auth.me()).resolves.toMatchObject({ id: 2, mustChangePassword: true });
  });

  it('returns the forced password-change status after a temporary-password login', async () => {
    const passwordHash = await hashPassword('temporary-password');
    getUserByUsername.mockResolvedValue({ id: 3, openId: 'local_personnel', username: 'alex.it', name: 'Alex IT', email: 'alex@example.com', loginMethod: 'password', passwordHash, mustChangePassword: true, isActive: true, role: 'user' });
    markUserSignedIn.mockResolvedValue(undefined);
    const { context } = createContext();
    const caller = appRouter.createCaller(context);

    const result = await caller.auth.login({ username: 'alex.it', password: 'temporary-password' });

    expect(result.mustChangePassword).toBe(true);
  });

  it('allows admins to create a local IT personnel account without storing plain text password', async () => {
    createLocalUser.mockImplementation(async (input) => ({
      id: 8,
      openId: 'local_new',
      username: input.username,
      name: input.name,
      email: input.email,
      role: input.role,
      loginMethod: 'password',
      passwordHash: input.passwordHash,
      isActive: true,
    }));
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    await caller.admin.users.create({
      username: 'new.tech',
      name: 'New Technician',
      email: 'new.tech@example.com',
      password: 'secure-password',
      role: 'user',
    });

    const createdInput = createLocalUser.mock.calls[0][0];
    expect(createdInput.passwordHash).not.toBe('secure-password');
    expect(await verifyPassword('secure-password', createdInput.passwordHash)).toBe(true);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_created', actorId: 1 }));
  });

  it('allows admins to update a personnel account and records the change', async () => {
    getManagedUser.mockResolvedValue({ id: 8, username: 'new.tech', name: 'New Technician', email: null, isActive: true, role: 'user' });
    updateManagedUser.mockResolvedValue([{ id: 8, username: 'new.tech', isActive: false, role: 'user' }]);
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    const result = await caller.admin.users.update({ id: 8, isActive: false });

    expect(result).toEqual([{ id: 8, username: 'new.tech', isActive: false, role: 'user' }]);
    expect(updateManagedUser).toHaveBeenCalledWith(8, { isActive: false });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_updated', actorId: 1 }));
  });

  it('allows admins to edit identity details without exposing password data', async () => {
    getManagedUser.mockResolvedValue({ id: 8, username: 'old.tech', name: 'Old Name', email: null, isActive: true, role: 'user' });
    updateManagedUser.mockResolvedValue([{ id: 8, username: 'new.tech', name: 'New Name', email: 'new@example.com', isActive: true, role: 'admin' }]);
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    await caller.admin.users.update({ id: 8, username: 'new.tech', name: 'New Name', email: 'new@example.com', role: 'admin' });

    expect(updateManagedUser).toHaveBeenCalledWith(8, { username: 'new.tech', name: 'New Name', role: 'admin', email: 'new@example.com' });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_updated', metadata: expect.not.stringContaining('password') }));
  });

  it('allows a signed-in user to complete a forced password change', async () => {
    updateManagedUserPassword.mockResolvedValue(undefined);
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('user');
    const caller = appRouter.createCaller(context);

    await caller.auth.changePassword({ password: 'new-private-password' });

    const [, storedHash, mustChangePassword] = updateManagedUserPassword.mock.calls[0];
    expect(await verifyPassword('new-private-password', storedHash)).toBe(true);
    expect(mustChangePassword).toBe(false);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_password_changed', metadata: expect.stringContaining('forcedResetCompleted') }));
  });

  it('allows admins to change another user password using a hash', async () => {
    getManagedUser.mockResolvedValue({ id: 8, username: 'new.tech', name: 'New Technician', email: null, isActive: true, role: 'user' });
    updateManagedUserPassword.mockResolvedValue(undefined);
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    await caller.admin.users.changePassword({ id: 8, password: 'updated-password' });

    const [, storedHash] = updateManagedUserPassword.mock.calls[0];
    expect(storedHash).not.toBe('updated-password');
    expect(await verifyPassword('updated-password', storedHash)).toBe(true);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_password_changed', metadata: expect.not.stringContaining('updated-password') }));
  });

  it('returns a generated temporary password for admin resets without auditing the secret', async () => {
    getManagedUser.mockResolvedValue({ id: 8, username: 'new.tech', name: 'New Technician', email: null, isActive: true, role: 'user' });
    updateManagedUserPassword.mockResolvedValue(undefined);
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    const result = await caller.admin.users.resetPassword({ id: 8 });

    expect(result.temporaryPassword).toHaveLength(16);
    const [, storedHash, mustChangePassword] = updateManagedUserPassword.mock.calls[0];
    expect(await verifyPassword(result.temporaryPassword, storedHash)).toBe(true);
    expect(mustChangePassword).toBe(true);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_password_reset', metadata: expect.not.stringContaining(result.temporaryPassword) }));
  });

  it('deletes a non-admin account and preserves the audit record', async () => {
    getManagedUser.mockResolvedValue({ id: 8, username: 'former.tech', name: 'Former Technician', email: null, isActive: true, role: 'user' });
    deleteManagedUser.mockResolvedValue(undefined);
    createAuditEvent.mockResolvedValue(undefined);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    await expect(caller.admin.users.delete({ id: 8 })).resolves.toEqual({ success: true });

    expect(deleteManagedUser).toHaveBeenCalledWith(8);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_deleted', actorId: 1 }));
  });

  it('prevents deletion of the last active administrator, self-delete, self-demotion, and protects non-admins', async () => {
    getManagedUser.mockResolvedValue({ id: 8, username: 'other-admin', name: 'Other Admin', email: null, isActive: true, role: 'admin' });
    countActiveAdmins.mockResolvedValue(1);
    const { context } = createContext('admin');
    const caller = appRouter.createCaller(context);

    await expect(caller.admin.users.delete({ id: 8 })).rejects.toThrow('At least one active administrator must remain');
    expect(deleteManagedUser).not.toHaveBeenCalled();

    getManagedUser.mockResolvedValue({ id: 1, username: 'admin', name: 'Admin User', email: 'admin@example.com', isActive: true, role: 'admin' });
    await expect(caller.admin.users.delete({ id: 1 })).rejects.toThrow('You cannot delete your own account');
    await expect(caller.admin.users.update({ id: 1, role: 'user' })).rejects.toThrow('You cannot remove your own admin access');

    const { context: userContext } = createContext('user');
    const userCaller = appRouter.createCaller(userContext);
    await expect(userCaller.admin.users.resetPassword({ id: 8 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks non-admin users from listing managed accounts', async () => {
    listManagedUsers.mockResolvedValue([]);
    const { context } = createContext('user');
    const caller = appRouter.createCaller(context);

    await expect(caller.admin.users.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(listManagedUsers).not.toHaveBeenCalled();
  });
});
