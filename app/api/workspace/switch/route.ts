import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/workspace-cookie";

const switchSchema = z.object({
  workspaceId: z.string().min(1),
});

/**
 * Switch the active workspace: validates the user is a member, then records
 * the selection in the workspace_id cookie so the dashboard layout and API
 * context resolve that workspace on subsequent requests.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const parsed = switchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Missing workspace ID" },
      { status: 400 }
    );
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parsed.data.workspaceId,
        userId: session.user.id,
      },
    },
    select: { workspaceId: true },
  });
  if (!membership) {
    return NextResponse.json(
      { success: false, error: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    WORKSPACE_COOKIE,
    membership.workspaceId,
    workspaceCookieOptions()
  );
  return response;
}
