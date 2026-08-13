import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { snapshotHeaders } from "@/lib/server/api-snapshots";
import {
  ALL_OVERVIEW_TTL_SECONDS,
  loadOverviewData,
  loadOverviewDataImpl,
  overviewSnapshotTag,
  parseOverviewCount,
  RECENT_OVERVIEW_TTL_SECONDS,
} from "@/lib/server/overview";

// Allow time for paginated media + per-post insight calls on larger accounts.
export const maxDuration = 60;

/**
 * Overview API — thin wrapper around `loadOverviewData` (lib/server/overview.ts).
 *
 * The Overview page itself is a Server Component that calls the same loader
 * directly; this route remains for the manual refresh island (which primes the
 * snapshot with `refresh=true` before the page re-renders) and any external
 * consumers.
 *
 * Manual refresh is bypass-aware: it first expires the `use cache` entry for
 * this account (all ranges) via `revalidateTag`, then runs the uncached impl so
 * the page's next render after `router.refresh()` reads the freshly rewritten
 * snapshot instead of a stale in-process copy.
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
      {
        success: false,
        error:
          "Instagram account not connected. Please connect your account first.",
      },
      { status: 400 }
    );
  }

  try {
    const count = parseOverviewCount(
      request.nextUrl.searchParams.get("count")
    );
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    let result;
    if (refresh) {
      // Expire the in-process copy so the page's next render (after the
      // refresh island calls router.refresh()) is a cache miss and reads the
      // freshly rewritten snapshot. The refetch itself runs uncached.
      revalidateTag(overviewSnapshotTag(account.id), { expire: 0 });
      result = await loadOverviewDataImpl({
        workspaceId,
        account,
        count,
        refresh: true,
      });
    } else {
      result = await loadOverviewData({ workspaceId, account, count });
    }
    const { data, snapshot } = result;
    const ttlSeconds =
      count === "all"
        ? ALL_OVERVIEW_TTL_SECONDS
        : RECENT_OVERVIEW_TTL_SECONDS;

    return NextResponse.json(
      {
        success: true,
        data,
        snapshot,
      },
      { headers: snapshotHeaders(ttlSeconds, snapshot.status) }
    );
  } catch (err) {
    console.error("[Instagram Overview] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load Instagram overview" },
      { status: 500 }
    );
  }
}
