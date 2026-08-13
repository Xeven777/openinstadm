import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { snapshotHeaders } from "@/lib/server/api-snapshots";
import {
  loadProfileData,
  loadProfileDataImpl,
  PROFILE_TTL_SECONDS,
  profileSnapshotTag,
} from "@/lib/server/instagram-media";

/**
 * Profile API — thin wrapper around `loadProfileData` (lib/server/instagram-media.ts).
 *
 * Manual refresh is bypass-aware: it first expires the `use cache` entry for
 * this account via `revalidateTag`, then runs the uncached impl so the response
 * — and every subsequent read until the window elapses — comes from the freshly
 * rewritten snapshot, never a stale in-process copy.
 */
export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected" },
      { status: 400 }
    );
  }

  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    let result;
    if (refresh) {
      revalidateTag(profileSnapshotTag(account.id), { expire: 0 });
      result = await loadProfileDataImpl({
        workspaceId,
        account,
        refresh: true,
      });
    } else {
      result = await loadProfileData({ workspaceId, account });
    }
    const { data, snapshot } = result;

    return NextResponse.json(
      {
        success: true,
        data,
        snapshot,
      },
      { headers: snapshotHeaders(PROFILE_TTL_SECONDS, snapshot.status) }
    );
  } catch (err) {
    console.error("[Instagram Profile] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
