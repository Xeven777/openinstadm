import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { invalidateMembersCache } from "@/lib/server/members";
import type {
  Workspace,
  WorkspacePermission,
  WorkspaceRole,
} from "@/app/generated/prisma/client";

function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function acceptPendingInvitationsForUser(
  userId: string,
  email?: string | null
): Promise<void> {
  if (!email) return;

  const normalizedEmail = normalizeInviteEmail(email);
  const now = new Date();
  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      email: normalizedEmail,
      status: "PENDING",
      expiresAt: { gt: now },
    },
  });

  for (const invitation of invitations) {
    await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: "MEMBER",
          permissions: invitation.permissions,
        },
        // An already-added member may have permissions changed after this
        // invitation was issued. Accepting a stale invite must not overwrite
        // the owner's newer decision.
        update: {},
      }),
      prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
        },
      }),
    ]);
    invalidateMembersCache(invitation.workspaceId);
    invalidateUserWorkspaces(userId);
  }
}

export interface UserWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  permissions: WorkspacePermission[];
}

/**
 * All workspaces the user belongs to, oldest first. Powers the workspace
 * switcher and lets the layout/API context honor the active-workspace cookie.
 */
export async function getUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(`workspaces:${userId}`);

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((membership) => ({
    id: membership.workspaceId,
    name: membership.workspace.name,
    role: membership.role,
    permissions: membership.permissions,
  }));
}

/**
 * Invalidate the cached workspace list for a user. Call whenever a membership
 * is added or removed (invite accept, direct-add, removal) so the switcher and
 * the layout's workspace resolution pick the change up immediately.
 */
export function invalidateUserWorkspaces(userId: string): void {
  revalidateTag(`workspaces:${userId}`, { expire: 0 });
  revalidateTag(`workspace-context:${userId}`, { expire: 0 });
}

export async function getWorkspaceMembership(userId: string): Promise<{
  workspace: Workspace;
  role: WorkspaceRole;
  permissions: WorkspacePermission[];
} | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) return null;

  return {
    workspace: membership.workspace,
    role: membership.role,
    permissions: membership.permissions,
  };
}

export async function ensureWorkspaceForUser(
  userId: string,
  email?: string | null
): Promise<Workspace> {
  await acceptPendingInvitationsForUser(userId, email);

  const existingMembership = await getWorkspaceMembership(userId);
  if (existingMembership) {
    return existingMembership.workspace;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const displayName = user?.name?.trim() ?? email?.split("@")[0] ?? "User";
  const workspaceName = `${displayName}'s workspace`;

  return prisma.workspace.create({
    data: {
      name: workspaceName,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });
}

export async function getPrimaryWorkspace(userId: string): Promise<Workspace | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(`workspace:${userId}`);
  const membership = await getWorkspaceMembership(userId);
  return membership?.workspace ?? null;
}
