import type { WorkspaceRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { buildInvitationUrl } from "@/lib/workspace-invitations";

/**
 * Shared server-side query for the workspace team settings.
 *
 * Dates are serialized to ISO strings so the same payload can be JSON-encoded
 * (members API route) and passed straight into the settings page's client
 * islands. Used by both the route handlers and the Server Component so the
 * shape lives in exactly one place.
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
      where: { workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
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
      inviteUrl: buildInvitationUrl(invitation.token),
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}
