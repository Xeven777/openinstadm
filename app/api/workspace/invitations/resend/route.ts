import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { sendInviteEmail } from "@/lib/server/invite-email";
import { getWorkspaceMembers, invalidateMembersCache } from "@/lib/server/members";
import {
  buildInvitationUrl,
  getInvitationExpiry,
} from "@/lib/workspace-invitations";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

const resendSchema = z.object({
  invitationId: z.string().min(1),
});

/**
 * Resend an invite: re-sends the email for the same token (the link the
 * invitee already has keeps working) and pushes the expiry out another 14
 * days from today. An expired invite is reactivated (status back to PENDING),
 * so the same row is reused instead of creating a duplicate.
 */
export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can resend invites" },
      { status: 403 }
    );
  }

  const parsed = resendSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid invitation" },
      { status: 400 }
    );
  }

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      id: parsed.data.invitationId,
      workspaceId: context.workspaceId,
      status: { in: ["PENDING", "EXPIRED"] },
    },
    include: { workspace: { select: { name: true } } },
  });
  if (!invitation) {
    return NextResponse.json(
      { success: false, error: "Invitation is no longer available" },
      { status: 404 }
    );
  }

  // Reactivate expired invites: same token (stable link), fresh expiry window.
  const updated = await prisma.workspaceInvitation.update({
    where: { id: invitation.id },
    data: {
      status: "PENDING",
      expiresAt: getInvitationExpiry(),
    },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { name: true, email: true },
  });

  const emailSent = await sendInviteEmail({
    to: invitation.email,
    workspaceName: invitation.workspace.name,
    // Invitations are only ever created as ADMIN or MEMBER (zod-enforced).
    role: invitation.role === "OWNER" ? "MEMBER" : invitation.role,
    inviteUrl: buildInvitationUrl(updated.token),
    invitedBy: inviter?.name || inviter?.email || "A workspace admin",
  });

  invalidateMembersCache(context.workspaceId);

  return NextResponse.json({
    success: true,
    emailSent,
    data: await getWorkspaceMembers(context.workspaceId, context.role),
  });
}
