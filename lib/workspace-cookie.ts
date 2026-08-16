/**
 * Active-workspace cookie.
 *
 * The dashboard and every API route resolve the "current" workspace from this
 * cookie (set by the workspace switch route and on invite acceptance) so a
 * user with multiple memberships isn't stuck on their oldest one. Cookie
 * writes happen only in Route Handlers — RSC render cannot set cookies.
 */
export const WORKSPACE_COOKIE = "workspace_id";

export function workspaceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // A year — the selection is a preference, not a secret.
    maxAge: 60 * 60 * 24 * 365,
  };
}
