import { describe, expect, it } from "vitest";
import { getEntryRoute } from "./authRoute";

describe("entry route", () => {
  it("redirects an unauthenticated root visitor to the /login URL", () => {
    expect(
      getEntryRoute({ location: "/", loading: false, isAuthenticated: false }),
    ).toBe("redirect");
  });

  it("keeps the login route visible while authentication is loading", () => {
    expect(
      getEntryRoute({ location: "/login", loading: true, isAuthenticated: false }),
    ).toBe("login");
  });

  it("shows the loading shell while the current session is being checked", () => {
    expect(
      getEntryRoute({ location: "/", loading: true, isAuthenticated: false }),
    ).toBe("loading");
  });

  it("allows authenticated users into the application", () => {
    expect(
      getEntryRoute({ location: "/", loading: false, isAuthenticated: true }),
    ).toBe("app");
  });

  it("redirects users with a reset password to the change-password route", () => {
    expect(
      getEntryRoute({ location: "/", loading: false, isAuthenticated: true, mustChangePassword: true }),
    ).toBe("password-change-redirect");
  });

  it("shows the change-password screen only while the reset requirement is active", () => {
    expect(
      getEntryRoute({ location: "/change-password", loading: false, isAuthenticated: true, mustChangePassword: true }),
    ).toBe("password-change");
    expect(
      getEntryRoute({ location: "/change-password", loading: false, isAuthenticated: true, mustChangePassword: false }),
    ).toBe("app");
  });
});
