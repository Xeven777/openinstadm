import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getLogsPage } from "@/lib/server/logs";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10))
  );
  const status = searchParams.get("status");
  const instagramAccountId = searchParams.get("instagramAccountId");

  const result = await getLogsPage(workspaceId, {
    page,
    limit,
    status,
    instagramAccountId,
  });

  return NextResponse.json(
    {
      success: true,
      data: result,
    },
    // Short-lived browser cache: fresh enough for a logs view, and the
    // client-side SWR cache (where this endpoint is still consumed) already
    // revalidates on every visit.
    { headers: { "Cache-Control": "private, max-age=10" } }
  );
}