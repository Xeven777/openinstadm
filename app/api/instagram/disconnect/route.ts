import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { invalidateSettingsCache } from "@/lib/server/settings";
import { invalidateWorkspaceStats } from "@/lib/server/stats";
import {
  canManageInstagramAccounts,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!canManageInstagramAccounts(context)) {
    return NextResponse.json(
      { success: false, error: "You do not have permission to disconnect accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const instagramAccountId =
    typeof body.instagramAccountId === "string" ? body.instagramAccountId : null;

  await prisma.instagramAccount.deleteMany({
    where: {
      workspaceId: context.workspaceId,
      ...(instagramAccountId ? { id: instagramAccountId } : {}),
    },
  });

  // The dashboard stats cache includes the account list — drop it so a
  // disconnect shows up immediately instead of lingering for the TTL.
  invalidateWorkspaceStats(context.workspaceId);
  invalidateSettingsCache(context.workspaceId);

  return NextResponse.json({ success: true });
}
