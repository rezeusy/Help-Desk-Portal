// @vitest-environment jsdom

import React, { act } from "react";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setLocation = vi.fn();
let currentLocation = "/";
let currentUser: { mustChangePassword?: boolean } | null = null;
let currentLoading = false;

vi.mock("wouter", () => ({
  Route: () => null,
  Switch: ({ children }: { children: React.ReactNode }) => children,
  useLocation: () => [currentLocation, setLocation],
}));

vi.mock("./_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: currentUser, loading: currentLoading }),
}));

vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({ TooltipProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("./components/ErrorBoundary", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("./contexts/ThemeContext", () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("./components/DashboardLayout", () => ({ default: () => null }));
vi.mock("./components/DashboardLayoutSkeleton", () => ({ DashboardLayoutSkeleton: () => null }));
vi.mock("@/pages/NotFound", () => ({ default: () => null }));
vi.mock("./pages/Dashboard", () => ({ default: () => null }));
vi.mock("./pages/MasterInventory", () => ({ default: () => null }));
vi.mock("@/pages/LocationDetail", () => ({ default: () => null }));
vi.mock("@/pages/AuditHistory", () => ({ default: () => null }));
vi.mock("./pages/Login", () => ({ default: () => null }));
vi.mock("./pages/AdminUsers", () => ({ default: () => null }));
vi.mock("./pages/ChangePassword", () => ({ default: () => null }));

import App from "./App";

describe("App login redirect", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    currentLocation = "/";
    currentUser = null;
    currentLoading = false;
    setLocation.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("navigates an unauthenticated root visit to /login", async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(setLocation).toHaveBeenCalledWith("/login");
  });

  it("redirects an unauthenticated inventory visit before Export Excel can render", async () => {
    currentLocation = "/inventory";

    await act(async () => {
      root.render(<App />);
    });

    expect(setLocation).toHaveBeenCalledWith("/login");
    expect(container.textContent).not.toContain("Export Excel");
  });

  it("navigates a reset-required authenticated user to /change-password", async () => {
    currentUser = { mustChangePassword: true };

    await act(async () => {
      root.render(<App />);
    });

    expect(setLocation).toHaveBeenCalledWith("/change-password");
  });
});
