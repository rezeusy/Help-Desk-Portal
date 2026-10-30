import { describe, expect, it } from "vitest";
import { getAutomaticLoginRedirect } from "./mainAuth";

describe("main authentication redirect", () => {
  it("routes an unauthorized protected-page error to /login", () => {
    expect(
      getAutomaticLoginRedirect({ isUnauthorized: true, currentPath: "/" }),
    ).toBe("/login");
  });

  it("does not redirect when the API error is unrelated to authentication", () => {
    expect(
      getAutomaticLoginRedirect({ isUnauthorized: false, currentPath: "/" }),
    ).toBeNull();
  });

  it("does not create an OAuth redirect loop on /login", () => {
    expect(
      getAutomaticLoginRedirect({ isUnauthorized: true, currentPath: "/login" }),
    ).toBeNull();
  });
});
