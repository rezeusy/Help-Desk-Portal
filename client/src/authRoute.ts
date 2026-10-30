export type EntryRouteState = "login" | "loading" | "redirect" | "password-change" | "password-change-redirect" | "app";

export function getEntryRoute(input: {
  location: string;
  loading: boolean;
  isAuthenticated: boolean;
  mustChangePassword?: boolean;
}): EntryRouteState {
  if (input.location === "/login") return "login";
  if (input.loading) return "loading";
  if (!input.isAuthenticated) return "redirect";
  if (input.location === "/change-password") return input.mustChangePassword ? "password-change" : "app";
  if (input.mustChangePassword) return "password-change-redirect";
  return "app";
}
