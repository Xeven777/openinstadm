import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import {
  sendInviteEmail,
  sendMemberAddedEmail,
} from "@/lib/server/invite-email";
import { getWorkspaceMembers, invalidateMembersCache } from "@/lib/server/members";
import { WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import {
  buildInvitationUrl,
  generateInvitationToken,
  getInvitationExpiry,
  normalizeInvitationEmail,
} from "@/lib/workspace-invitations";
import { invalidateUserWorkspaces } from "@/lib/workspace";
import {
  canGrantMemberPermissions,
  canManageMembers,
  getCurrentWorkspaceContext,
  invalidateWorkspaceContext,
} from "@/lib/workspace-access";

const permissionSchema = z.enum([
  "MANAGE_AUTOMATIONS",
  "MANAGE_INSTAGRAM_ACCOUNTS",
  "MANAGE_MEMBERS",
]);

const inviteSchema = z.object({
  email: z.string().email(),
  permissions: z
    .array(permissionSchema)
    .max(3)
    .default([])
    .refine((permissions) => new Set(permissions).size === permissions.length),
});

const updateMemberSchema = z.object({
  memberId: z.string().min(1),
  permissions: z
    .array(permissionSchema)
    .max(3)
    .refine((permissions) => new Set(permissions).size === permissions.length),
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
    data: await getWorkspaceMembers(
      context.workspaceId,
      context.role,
      context.permissions
    ),
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
  if (!canManageMembers(context)) {
    return NextResponse.json(
      { success: false, error: "You do not have permission to invite members" },
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

  if (
    parsed.data.permissions.length > 0 &&
    !canGrantMemberPermissions(context)
  ) {
    return NextResponse.json(
      { success: false, error: "Only the owner can grant permissions" },
      { status: 403 }
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
    inviter?.name || inviter?.email || "A workspace member";
  // Origin of the app (server-side; the dashboard link for added members).
  const signInUrl = `${
    (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
  }/dashboard`;

  // Email delivery is best-effort — invite still succeeds without Resend.
  // The invite link is always returned for manual sharing (copy-link flow).
  let emailSent = false;
  let addedExistingMember = false;
  let inviteUrl: string | null = null;

  if (existingUser) {
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: context.workspaceId,
          userId: existingUser.id,
        },
      },
      select: { id: true },
    });

    // A delegated member must never overwrite permissions the owner assigned
    // to an existing workspace member.
    if (existingMembership) {
      return NextResponse.json(
        {
          success: false,
          error: "This user is already a member of the workspace",
        },
        { status: 409 },
      );
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId: context.workspaceId,
        userId: existingUser.id,
        role: "MEMBER",
        permissions: parsed.data.permissions,
      },
    });
    addedExistingMember = true;
    invalidateUserWorkspaces(existingUser.id);
    invalidateWorkspaceContext(existingUser.id, context.workspaceId);

    emailSent = await sendMemberAddedEmail({
      to: email,
      workspaceName,
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
        role: "MEMBER",
        permissions: parsed.data.permissions,
        token: generateInvitationToken(),
        invitedByUserId: context.userId,
        expiresAt: getInvitationExpiry(),
      },
      update: {
        role: "MEMBER",
        ...(canGrantMemberPermissions(context)
          ? { permissions: parsed.data.permissions }
          : {}),
        status: "PENDING",
        token: generateInvitationToken(),
        invitedByUserId: context.userId,
        expiresAt: getInvitationExpiry(),
      },
    });

    inviteUrl = buildInvitationUrl(invitation.token);
    emailSent = await sendInviteEmail({
      to: email,
      workspaceName,
      inviteUrl,
      invitedBy,
    });
  }

  invalidateMembersCache(context.workspaceId);

  return NextResponse.json({
    success: true,
    emailSent,
    inviteUrl,
    addedExistingMember,
    data: await getWorkspaceMembers(
      context.workspaceId,
      context.role,
      context.permissions
    ),
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
  if (!canGrantMemberPermissions(context)) {
    return NextResponse.json(
      { success: false, error: "Only the owner can update permissions" },
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
    data: { permissions: parsed.data.permissions },
  });

  invalidateMembersCache(context.workspaceId);
  invalidateUserWorkspaces(member.userId);
  invalidateWorkspaceContext(member.userId, context.workspaceId);

  return NextResponse.json({
    success: true,
    data: await getWorkspaceMembers(
      context.workspaceId,
      context.role,
      context.permissions
    ),
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
    if (!member || member.role === "OWNER") {
      return NextResponse.json(
        { success: false, error: "Member cannot be removed" },
        { status: 400 }
      );
    }

    const isSelf = member.userId === context.userId;
    // Anyone can leave a workspace they belong to; removing someone else stays
    // a delegated MANAGE_MEMBERS action.
    if (!isSelf && !canManageMembers(context)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to remove members" },
        { status: 403 }
      );
    }

    await prisma.workspaceMember.delete({ where: { id: member.id } });
    invalidateUserWorkspaces(member.userId);
    invalidateWorkspaceContext(member.userId, context.workspaceId);
  }

  if (parsed.data.invitationId) {
    if (!canManageMembers(context)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to revoke invites" },
        { status: 403 }
      );
    }
    await prisma.workspaceInvitation.updateMany({
      where: {
        id: parsed.data.invitationId,
        workspaceId: context.workspaceId,
        status: { in: ["PENDING", "EXPIRED"] },
      },
      data: { status: "REVOKED" },
    });
  }

  invalidateMembersCache(context.workspaceId);

  const response = NextResponse.json({
    success: true,
    data: await getWorkspaceMembers(
      context.workspaceId,
      context.role,
      context.permissions
    ),
  });

  // Leaving the currently-active workspace: clear the selection so the next
  // navigation resolves a workspace the user is still a member of.
  const cookieStore = await cookies();
  if (cookieStore.get(WORKSPACE_COOKIE)?.value === context.workspaceId) {
    response.cookies.delete(WORKSPACE_COOKIE);
  }

  return response;
}
