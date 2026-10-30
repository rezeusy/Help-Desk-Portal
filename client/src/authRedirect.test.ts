import { describe, expect, it } from "vitest";
import {
  getAuthRedirectPath,
  getUnauthorizedRedirectPath,
  LOCAL_LOGIN_PATH,
} from "./authRedirect";

describe("unauthorized redirect", () => {
  it("redirects protected pages to the local login route", () => {
    expect(getUnauthorizedRedirectPath("/")).toBe(LOCAL_LOGIN_PATH);
    expect(getUnauthorizedRedirectPath("/master")).toBe(LOCAL_LOGIN_PATH);
  });

  it("does not redirect again when already on the local login route", () => {
    expect(getUnauthorizedRedirectPath(LOCAL_LOGIN_PATH)).toBeNull();
  });

  it("defaults automatic auth redirects to /login, never the Manus OAuth portal", () => {
    expect(getAuthRedirectPath()).toBe(LOCAL_LOGIN_PATH);
    expect(getAuthRedirectPath()).not.toContain("manus.im");
    expect(getUnauthorizedRedirectPath("/audit")).not.toContain("app-auth");
  });
});
