import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { snapshotHeaders } from "@/lib/server/api-snapshots";
import {
  ALL_POSTS_TTL_SECONDS,
  loadPostsData,
  loadPostsDataImpl,
  postsSnapshotTag,
  RECENT_POSTS_TTL_SECONDS,
} from "@/lib/server/instagram-media";

/**
 * Posts API — thin wrapper around `loadPostsData` (lib/server/instagram-media.ts).
 *
 * Manual refresh is bypass-aware: it first expires the `use cache` entry for
 * this account (all variants) via `revalidateTag`, then runs the uncached impl
 * so the response — and every subsequent read until the window elapses — comes
 * from the freshly rewritten snapshot, never a stale in-process copy.
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
    // `all=true` paginates the full library (for the campaign post picker);
    // otherwise return a single recent page.
    const loadAll = request.nextUrl.searchParams.get("all") === "true";
    const limitParam = request.nextUrl.searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 25;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 25;
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    const ttlSeconds = loadAll ? ALL_POSTS_TTL_SECONDS : RECENT_POSTS_TTL_SECONDS;

    let result;
    if (refresh) {
      revalidateTag(postsSnapshotTag(account.id), { expire: 0 });
      result = await loadPostsDataImpl({
        workspaceId,
        account,
        loadAll,
        limit,
        refresh: true,
      });
    } else {
      result = await loadPostsData({ workspaceId, account, loadAll, limit });
    }
    const { data, snapshot } = result;

    return NextResponse.json(
      {
        success: true,
        data,
        snapshot,
      },
      { headers: snapshotHeaders(ttlSeconds, snapshot.status) }
    );
  } catch (err) {
    console.error("[Instagram Posts] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Instagram posts" },
      { status: 500 }
    );
  }
}
