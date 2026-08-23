import type { Workspace, WorkspaceRole } from "@/app/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import { WORKSPACE_COOKIE } from "@/lib/workspace-cookie";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  workspace: Workspace;
  role: WorkspaceRole;
};

const ROLE_ORDER: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasWorkspaceRole(
  role: WorkspaceRole,
  minimumRole: WorkspaceRole
) {
  return ROLE_ORDER[role] >= ROLE_ORDER[minimumRole];
}

export function canManageWorkspace(role: WorkspaceRole) {
  return hasWorkspaceRole(role, "ADMIN");
}

export function canManageBilling(role: WorkspaceRole) {
  return role === "OWNER";
}

/**
 * Resolve the current user's workspace context (userId, workspaceId, role).
 *
 * auth() reads headers() which is dynamic and cannot live inside "use cache".
 * So we call auth() outside the cache boundary, then delegate to the cached
 * inner function which only touches the database.
 */
export async function getCurrentWorkspaceContext(): Promise<WorkspaceContext | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  // Honor the active-workspace cookie so a member of several workspaces
  // resolves the one they switched to instead of always their oldest.
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  return getCachedWorkspaceContext(userId, requestedWorkspaceId);
}
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const context = await getCurrentWorkspaceContext();
  return context?.workspaceId ?? null;
}
/**
 * Cached workspace lookup — keyed by userId + requested workspace so different
 * members (and a member switching workspaces) never share context. 30s stale
 * keeps return navigations instant while still picking up role changes within
 * a minute.
 */
async function getCachedWorkspaceContext(
  userId: string,
  requestedWorkspaceId: string | null
): Promise<WorkspaceContext | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(`workspace-ctx:${userId}:${requestedWorkspaceId ?? "primary"}`);

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  // The cookie wins when it names a workspace the user still belongs to;
  // otherwise fall back to the oldest membership.
  const membership =
    memberships.find((m) => m.workspaceId === requestedWorkspaceId) ??
    memberships[0];

  if (membership) {
    return {
      userId,
      workspaceId: membership.workspaceId,
      workspace: membership.workspace,
      role: membership.role,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const workspace = await ensureWorkspaceForUser(userId, user?.email);
  const createdMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  return {
    userId,
    workspaceId: workspace.id,
    workspace,
    role: createdMembership?.role ?? "OWNER",
  };
}

