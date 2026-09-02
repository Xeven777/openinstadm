import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { invalidateMembersCache } from "@/lib/server/members";
import { invalidateUserWorkspaces } from "@/lib/workspace";
import { invalidateWorkspaceContext } from "@/lib/workspace-access";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/workspace-cookie";
import { normalizeInvitationEmail } from "@/lib/workspace-invitations";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { success: false, error: "Sign in with the invited email first" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : null;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing invitation token" },
      { status: 400 }
    );
  }

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: { select: { name: true } } },
  });
  if (!invitation || invitation.status !== "PENDING") {
    return NextResponse.json(
      { success: false, error: "Invitation is no longer available" },
      { status: 404 }
    );
  }

  if (invitation.expiresAt <= new Date()) {
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json(
      { success: false, error: "Invitation has expired" },
      { status: 410 }
    );
  }

  if (normalizeInvitationEmail(session.user.email) !== invitation.email) {
    return NextResponse.json(
      { success: false, error: "This invitation is for a different email" },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: session.user.id,
        },
      },
      create: {
        workspaceId: invitation.workspaceId,
        userId: session.user.id,
        role: "MEMBER",
        permissions: invitation.permissions,
      },
      // Do not let an older invite overwrite permissions the owner changed
      // after the member was added to this workspace.
      update: {},
    }),
    prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  invalidateMembersCache(invitation.workspaceId);
  invalidateUserWorkspaces(session.user.id);
  invalidateWorkspaceContext(session.user.id, invitation.workspaceId);

  // Land the invitee in the workspace they just joined — the dashboard layout
  // resolves the active workspace from this cookie.
  const response = NextResponse.json({
    success: true,
    data: {
      workspaceName: invitation.workspace.name,
    },
  });
  response.cookies.set(
    WORKSPACE_COOKIE,
    invitation.workspaceId,
    workspaceCookieOptions()
  );
  return response;
}

