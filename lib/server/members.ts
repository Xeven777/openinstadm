import type {
  WorkspacePermission,
  WorkspaceRole,
} from "@/app/generated/prisma/client";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { buildInvitationUrl } from "@/lib/workspace-invitations";

/**
 * Invalidate the cached members payload for a workspace.
 *
 * Call this from any route that mutates team membership (invite, revoke,
 * accept) so the next navigation serves fresh data.
 */
export function invalidateMembersCache(workspaceId: string): void {
  revalidateTag(`members:${workspaceId}`, { expire: 0 });
}

/**
 * Shared server-side query for the workspace team settings.
 *
 * Cached for 30s stale — fast on return navigations while still picking up
 * new invites and removals within a minute. Dates are serialized to ISO
 * strings so the same payload can be JSON-encoded (members API route) and
 * passed straight into the settings page's client islands.
 */

export interface SettingsMember {
  id: string;
  role: WorkspaceRole;
  permissions: WorkspacePermission[];
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
}

export interface SettingsInvitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  permissions: WorkspacePermission[];
  status: "PENDING" | "EXPIRED";
  inviteUrl: string;
  expiresAt: string;
}

export interface WorkspaceMembersPayload {
  currentUserRole: WorkspaceRole;
  currentUserPermissions: WorkspacePermission[];
  members: SettingsMember[];
  invitations: SettingsInvitation[];
}

export async function getWorkspaceMembers(
  workspaceId: string,
  currentUserRole: WorkspaceRole,
  currentUserPermissions: WorkspacePermission[]
): Promise<WorkspaceMembersPayload> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(`members:${workspaceId}`);

  const canManageMembers =
    currentUserRole === "OWNER" ||
    currentUserPermissions.includes("MANAGE_MEMBERS");
  const canViewMemberPermissions = currentUserRole === "OWNER";

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        permissions: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    // Invite links carry an authentication token. Only people who can manage
    // the team may retrieve or share them.
    canManageMembers
      ? prisma.workspaceInvitation.findMany({
          where: { workspaceId, status: { in: ["PENDING", "EXPIRED"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            role: true,
            permissions: true,
            status: true,
            token: true,
            expiresAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    currentUserRole,
    currentUserPermissions,
    members: members.map((member) => ({
      ...member,
      // A plain member only needs their own permissions, which are already
      // provided by currentUserPermissions. Do not disclose other members'
      // delegated access in the team payload.
      permissions: canViewMemberPermissions ? member.permissions : [],
      createdAt: member.createdAt.toISOString(),
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      permissions: invitation.permissions,
      // The query above restricts to PENDING/EXPIRED, so the enum narrows safely.
      status: invitation.status as "PENDING" | "EXPIRED",
      inviteUrl: buildInvitationUrl(invitation.token),
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}
