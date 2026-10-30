import { describe, expect, it, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext['res'],
  };
}

describe('protected inventory export', () => {
  it('rejects unauthenticated callers before reading inventory data', async () => {
    const caller = appRouter.createCaller(createAnonymousContext());

    await expect(caller.reports.inventoryExport()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
