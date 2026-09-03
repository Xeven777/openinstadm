import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  canManageInstagramAccounts,
  getCurrentWorkspaceContext,
  getCurrentWorkspaceId,
} from "@/lib/workspace-access";
import { prisma } from "@/lib/db/client";
import { invalidateSettingsCache } from "@/lib/server/settings";

/**
 * The workspace's connected Instagram accounts — just enough for an account
 * selector. This is a single indexed query, unlike /api/dashboard/stats which
 * runs the full analytics aggregation. Pages that only need the account list
 * (e.g. the inbox) should use this so they aren't gated on heavy stats.
 */
export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const instagramAccounts = await prisma.instagramAccount.findMany({
    where: { workspaceId },
    orderBy: { connectedAt: "desc" },
    select: { id: true, username: true, instagramId: true, name: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      instagramAccounts,
      selectedInstagramAccountId: instagramAccounts[0]?.id ?? null,
    },
  });
}

const patchSchema = z
  .object({
    instagramAccountId: z.string().min(1),
    fallbackReplyEnabled: z.boolean(),
    fallbackReplyMessage: z.string().max(1000).nullable().optional(),
  })
  .refine(
    (d) => !d.fallbackReplyEnabled || Boolean(d.fallbackReplyMessage?.trim()),
    {
      message: "Message is required when auto-reply is enabled",
      path: ["fallbackReplyMessage"],
    }
  );

export async function PATCH(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageInstagramAccounts(context)) {
    return NextResponse.json(
      { success: false, error: "You do not have permission to update Instagram accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { instagramAccountId, fallbackReplyEnabled, fallbackReplyMessage } = parsed.data;

  const account = await prisma.instagramAccount.findFirst({
    where: { id: instagramAccountId, workspaceId: context.workspaceId },
  });
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not found" },
      { status: 404 }
    );
  }

  const updated = await prisma.instagramAccount.update({
    where: { id: instagramAccountId },
    data: {
      fallbackReplyEnabled,
      fallbackReplyMessage: fallbackReplyEnabled
        ? (fallbackReplyMessage?.trim() ?? null)
        : null,
    },
    select: {
      id: true,
      username: true,
      instagramId: true,
      name: true,
      fallbackReplyEnabled: true,
      fallbackReplyMessage: true,
    },
  });

  invalidateSettingsCache(context.workspaceId);

  return NextResponse.json({ success: true, data: updated });
}
