export const LOCAL_LOGIN_PATH = "/login";

export function getUnauthorizedRedirectPath(currentPath: string): string | null {
  return currentPath === LOCAL_LOGIN_PATH ? null : LOCAL_LOGIN_PATH;
}

export function getAuthRedirectPath(redirectPath?: string): string {
  return redirectPath ?? LOCAL_LOGIN_PATH;
}
