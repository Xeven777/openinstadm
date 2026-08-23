import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getDiagnosticsData } from "@/lib/server/diagnostics";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const data = await getDiagnosticsData(workspaceId);

  return NextResponse.json({
    success: true,
    data,
  });
}
