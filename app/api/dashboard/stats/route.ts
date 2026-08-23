import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getDashboardStats } from "@/lib/server/stats";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = await getCurrentUserId();
  const requestedInstagramAccountId =
    request.nextUrl.searchParams.get("instagramAccountId");
  const selectedAccountId =
    requestedInstagramAccountId && requestedInstagramAccountId !== "all"
      ? requestedInstagramAccountId
      : null;

  const data = await getDashboardStats(workspaceId, userId, selectedAccountId);

  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      // Dashboard tiles are fine 30s stale; the client-side SWR cache already
      // refreshes them on every visit.
      headers: { "Cache-Control": "private, max-age=30" },
    }
  );
}
