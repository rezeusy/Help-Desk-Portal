// @vitest-environment jsdom

import React, { act } from 'react';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const { changePassword, toast } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/trpc', () => ({
  trpc: { auth: { changePassword: { useMutation: () => ({ mutate: changePassword, isPending: false }) } } },
}));
vi.mock('sonner', () => ({ toast }));

import ChangePassword from './ChangePassword';

describe('ChangePassword', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    changePassword.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const setInput = (id: string, value: string) => {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Input not found: ${id}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('rejects mismatched passwords before calling the server', async () => {
    await act(async () => root.render(<ChangePassword />));
    await act(async () => setInput('new-password', 'new-private-password'));
    await act(async () => setInput('confirm-password', 'different-password'));
    await act(async () => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click());

    expect(changePassword).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Passwords do not match');
  });

  it('submits a valid new password', async () => {
    await act(async () => root.render(<ChangePassword />));
    await act(async () => setInput('new-password', 'new-private-password'));
    await act(async () => setInput('confirm-password', 'new-private-password'));
    await act(async () => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click());

    expect(changePassword).toHaveBeenCalledWith({ password: 'new-private-password' });
  });
});
