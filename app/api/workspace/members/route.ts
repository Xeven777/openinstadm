import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  sendInviteEmail,
  sendMemberAddedEmail,
} from "@/lib/server/invite-email";
import { getWorkspaceMembers, invalidateMembersCache } from "@/lib/server/members";
import {
  buildInvitationUrl,
  generateInvitationToken,
  getInvitationExpiry,
  normalizeInvitationEmail,
} from "@/lib/workspace-invitations";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

const updateMemberSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]),
});

const deleteSchema = z.object({
  memberId: z.string().min(1).optional(),
  invitationId: z.string().min(1).optional(),
});

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: await getWorkspaceMembers(context.workspaceId, context.role),
  });
}

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
      { success: false, error: "Only owners and admins can invite members" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid invitation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = normalizeInvitationEmail(parsed.data.email);
  const [existingUser, inviter, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: context.userId },
      select: { name: true, email: true },
    }),
    prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: { name: true },
    }),
  ]);

  const workspaceName = workspace?.name ?? "your workspace";
  const invitedBy =
    inviter?.name || inviter?.email || "A workspace admin";
  // Origin of the app (server-side; the dashboard link for added members).
  const signInUrl = `${
    (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
  }/dashboard`;

  // Email delivery is best-effort — a failed send never fails the invite.
  // The inviter still gets the copyable link in the UI as a fallback.
  let emailSent = false;

  if (existingUser) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: context.workspaceId,
          userId: existingUser.id,
        },
      },
      create: {
        workspaceId: context.workspaceId,
        userId: existingUser.id,
        role: parsed.data.role,
      },
      update: {
        role: parsed.data.role,
      },
    });

    emailSent = await sendMemberAddedEmail({
      to: email,
      workspaceName,
      role: parsed.data.role,
      signInUrl,
    });
  } else {
    const invitation = await prisma.workspaceInvitation.upsert({
      where: {
        workspaceId_email: {
          workspaceId: context.workspaceId,
          email,
        },
      },
      create: {
        workspaceId: context.workspaceId,
        email,
        role: parsed.data.role,
        token: generateInvitationToken(),
        invitedByUserId: context.userId,
        expiresAt: getInvitationExpiry(),
      },
      update: {
        role: parsed.data.role,
        status: "PENDING",
        token: generateInvitationToken(),
        invitedByUserId: context.userId,
        expiresAt: getInvitationExpiry(),
      },
    });

    emailSent = await sendInviteEmail({
      to: email,
      workspaceName,
      role: parsed.data.role,
      inviteUrl: buildInvitationUrl(invitation.token),
      invitedBy,
    });
  }

  invalidateMembersCache(context.workspaceId);

  return NextResponse.json({
    success: true,
    emailSent,
    data: await getWorkspaceMembers(context.workspaceId, context.role),
  });
}

export async function PATCH(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can update roles" },
      { status: 403 }
    );
  }

  const parsed = updateMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid member update" },
      { status: 400 }
    );
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { id: parsed.data.memberId, workspaceId: context.workspaceId },
  });
  if (!member || member.role === "OWNER") {
    return NextResponse.json(
      { success: false, error: "Member cannot be updated" },
      { status: 400 }
    );
  }

  await prisma.workspaceMember.update({
    where: { id: member.id },
    data: { role: parsed.data.role },
  });

  invalidateMembersCache(context.workspaceId);

  return NextResponse.json({
    success: true,
    data: await getWorkspaceMembers(context.workspaceId, context.role),
  });
}

export async function DELETE(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can remove members" },
      { status: 403 }
    );
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || (!parsed.data.memberId && !parsed.data.invitationId)) {
    return NextResponse.json(
      { success: false, error: "Missing member or invitation ID" },
      { status: 400 }
    );
  }

  if (parsed.data.memberId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: parsed.data.memberId, workspaceId: context.workspaceId },
    });
    if (!member || member.role === "OWNER" || member.userId === context.userId) {
      return NextResponse.json(
        { success: false, error: "Member cannot be removed" },
        { status: 400 }
      );
    }

    await prisma.workspaceMember.delete({ where: { id: member.id } });
  }

  if (parsed.data.invitationId) {
    await prisma.workspaceInvitation.updateMany({
      where: {
        id: parsed.data.invitationId,
        workspaceId: context.workspaceId,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });
  }

  invalidateMembersCache(context.workspaceId);

  return NextResponse.json({
    success: true,
    data: await getWorkspaceMembers(context.workspaceId, context.role),
  });
}
