// @vitest-environment jsdom

import React from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    createClient: vi.fn(() => ({})),
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

let redirectToLoginIfUnauthorized: (
  error: unknown,
  assign?: (path: string) => void,
) => void;

beforeAll(async () => {
  document.body.innerHTML = '<div id="root"></div>';
  ({ redirectToLoginIfUnauthorized } = await import("./main"));
});

describe("main.tsx authentication bootstrap", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("routes the real unauthorized error handler to the local login page", () => {
    const assign = vi.fn();
    const error = new TRPCClientError(UNAUTHED_ERR_MSG);

    redirectToLoginIfUnauthorized(error, assign);

    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("does not invoke the automatic redirect for unrelated errors", () => {
    const assign = vi.fn();

    redirectToLoginIfUnauthorized(new Error(UNAUTHED_ERR_MSG), assign);

    expect(assign).not.toHaveBeenCalled();
  });
});
