import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  getAllUserMedia,
  getUserMedia,
  type InstagramMedia,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  buildApiSnapshotKey,
  getApiSnapshot,
  setApiSnapshot,
  snapshotHeaders,
} from "@/lib/server/api-snapshots";

const RECENT_POSTS_TTL_SECONDS = 60 * 60;
const ALL_POSTS_TTL_SECONDS = 2 * 60 * 60;

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
        error: "Instagram account not connected. Please connect your account first.",
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
    const ttlSeconds = loadAll ? ALL_POSTS_TTL_SECONDS : RECENT_POSTS_TTL_SECONDS;
    const snapshotKey = buildApiSnapshotKey({
      source: "ig:posts",
      accountId: account.id,
      params: loadAll ? { all: true, max: 300 } : { limit },
    });
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    const cached = await getApiSnapshot<InstagramMedia[]>(snapshotKey, {
      bypass: refresh,
    });
    if (cached) {
      return NextResponse.json(
        {
          success: true,
          data: cached.data,
          snapshot: {
            status: "HIT",
            fetchedAt: cached.fetchedAt,
            expiresAt: cached.expiresAt,
          },
        },
        { headers: snapshotHeaders(ttlSeconds, "HIT") }
      );
    }

    const accessToken = decryptToken(account.accessToken);
    let posts;
    if (loadAll) {
      posts = await getAllUserMedia(accessToken, 300);
    } else {
      posts = await getUserMedia(accessToken, limit);
    }

    const snapshot = await setApiSnapshot(
      {
        workspaceId,
        instagramAccountId: account.id,
        key: snapshotKey,
        source: "ig:posts",
      },
      posts,
      ttlSeconds * 1000
    );

    return NextResponse.json(
      {
        success: true,
        data: posts,
        snapshot: {
          status: "MISS",
          fetchedAt: snapshot.fetchedAt,
          expiresAt: snapshot.expiresAt,
        },
      },
      { headers: snapshotHeaders(ttlSeconds, "MISS") }
    );
  } catch (err) {
    console.error("[Instagram Posts] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Instagram posts" },
      { status: 500 }
    );
  }
}
