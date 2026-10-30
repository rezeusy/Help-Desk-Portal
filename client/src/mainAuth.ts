import { getUnauthorizedRedirectPath } from "./authRedirect";

export function getAutomaticLoginRedirect(input: {
  isUnauthorized: boolean;
  currentPath: string;
}): string | null {
  if (!input.isUnauthorized) return null;
  return getUnauthorizedRedirectPath(input.currentPath);
}
