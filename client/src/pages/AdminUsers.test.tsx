// @vitest-environment jsdom

import React, { act } from 'react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const managedUser = {
  id: 7,
  username: 'alex.it',
  name: 'Alex IT',
  email: 'alex@example.com',
  role: 'user' as const,
  isActive: true,
  loginMethod: 'password',
  lastSignedIn: new Date(),
};

const mutations = {
  create: vi.fn(),
  update: vi.fn(),
  changePassword: vi.fn(),
  resetPassword: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/_core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' }, loading: false }),
}));

vi.mock('wouter', () => ({ useLocation: () => ['/admin/users', vi.fn()] }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ admin: { users: { list: { invalidate: vi.fn() } } } }),
    admin: {
      users: {
        list: { useQuery: () => ({ data: [managedUser], isLoading: false, error: null }) },
        create: { useMutation: () => ({ mutate: mutations.create, isPending: false }) },
        update: { useMutation: () => ({ mutate: mutations.update, isPending: false }) },
        changePassword: { useMutation: () => ({ mutate: mutations.changePassword, isPending: false }) },
        resetPassword: { useMutation: () => ({ mutate: mutations.resetPassword, isPending: false }) },
        delete: { useMutation: () => ({ mutate: mutations.delete, isPending: false }) },
      },
    },
  },
}));

import AdminUsers from './AdminUsers';

describe('AdminUsers controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.values(mutations).forEach((mutation) => mutation.mockClear());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const button = (label: string) => {
    const match = Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes(label));
    if (!match) throw new Error(`Button not found: ${label}`);
    return match as HTMLButtonElement;
  };

  const setInput = (id: string, value: string) => {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Input not found: ${id}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('renders account editing, password, reset, and delete controls for admins', async () => {
    await act(async () => root.render(<AdminUsers />));

    expect(container.textContent).toContain('Edit');
    expect(container.textContent).toContain('Change pass');
    expect(container.textContent).toContain('Reset');
    expect(container.textContent).toContain('Delete');
    expect(container.textContent).toContain('alex.it');
  });

  it('submits edited account details from the edit dialog', async () => {
    await act(async () => root.render(<AdminUsers />));
    await act(async () => button('Edit').click());
    await act(async () => setInput('edit-name', 'Alex Updated'));
    await act(async () => button('Save changes').click());

    expect(mutations.update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: 'Alex Updated' }));
  });

  it('submits a new password from the change-password dialog', async () => {
    await act(async () => root.render(<AdminUsers />));
    await act(async () => button('Change pass').click());
    await act(async () => setInput('change-password', 'new-secure-password'));
    await act(async () => button('Change password').click());

    expect(mutations.changePassword).toHaveBeenCalledWith({ id: 7, password: 'new-secure-password' });
  });

  it('wires reset confirmation to the reset-password mutation', async () => {
    await act(async () => root.render(<AdminUsers />));
    await act(async () => button('Reset').click());
    await act(async () => button('Generate temporary password').click());

    expect(mutations.resetPassword).toHaveBeenCalledWith({ id: 7 });
  });

  it('wires delete confirmation to the delete mutation', async () => {
    await act(async () => root.render(<AdminUsers />));
    await act(async () => button('Delete').click());
    await act(async () => button('Delete account').click());

    expect(mutations.delete).toHaveBeenCalledWith({ id: 7 });
  });
});
