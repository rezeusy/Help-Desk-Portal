import { describe, expect, it, vi } from 'vitest';
import { getEntryRoute } from '../client/src/authRoute';
import { appRouter } from './routers';
import { hashPassword } from './_core/localAuth';
import type { TrpcContext } from './_core/context';

const { getUserByUsername, markUserSignedIn } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  markUserSignedIn: vi.fn(),
}));

vi.mock('./db', () => ({
  getUserByUsername,
  markUserSignedIn,
}));

function createContext(user: TrpcContext['user'] = null) {
  const cookies: Array<{ name: string; value: string }> = [];
  const context: TrpcContext = {
    user,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: {
      cookie: (name: string, value: string) => cookies.push({ name, value }),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
  return { context, cookies };
}

describe('forced reset login integration', () => {
  it('carries a reset-required local login through session restoration into the /change-password route', async () => {
    const passwordHash = await hashPassword('temporary-password');
    const resetRequiredUser = {
      id: 3,
      openId: 'local_personnel',
      username: 'alex.it',
      name: 'Alex IT',
      email: 'alex@example.com',
      loginMethod: 'password',
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    getUserByUsername.mockResolvedValue(resetRequiredUser);
    markUserSignedIn.mockResolvedValue(undefined);

    const loginContext = createContext();
    const loginCaller = appRouter.createCaller(loginContext.context);
    const loginResult = await loginCaller.auth.login({ username: 'alex.it', password: 'temporary-password' });

    const restoredContext = createContext({ ...resetRequiredUser, passwordHash: null }).context;
    const restoredCaller = appRouter.createCaller(restoredContext);
    const restoredUser = await restoredCaller.auth.me();
    const entryRoute = getEntryRoute({
      location: '/',
      loading: false,
      isAuthenticated: Boolean(restoredUser),
      mustChangePassword: Boolean(restoredUser?.mustChangePassword),
    });

    expect(loginResult.mustChangePassword).toBe(true);
    expect(loginContext.cookies).toHaveLength(1);
    expect(restoredUser?.mustChangePassword).toBe(true);
    expect(entryRoute).toBe('password-change-redirect');
  });
});
