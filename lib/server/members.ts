import type { WorkspaceRole } from "@/app/generated/prisma/client";
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
  status: "PENDING" | "EXPIRED";
  inviteUrl: string;
  expiresAt: string;
}

export interface WorkspaceMembersPayload {
  currentUserRole: WorkspaceRole;
  members: SettingsMember[];
  invitations: SettingsInvitation[];
}

export async function getWorkspaceMembers(
  workspaceId: string,
  currentUserRole: WorkspaceRole
): Promise<WorkspaceMembersPayload> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(`members:${workspaceId}`);

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
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
    prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: { in: ["PENDING", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    currentUserRole,
    members: members.map((member) => ({
      ...member,
      createdAt: member.createdAt.toISOString(),
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      // The query above restricts to PENDING/EXPIRED, so the enum narrows safely.
      status: invitation.status as "PENDING" | "EXPIRED",
      inviteUrl: buildInvitationUrl(invitation.token),
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}
