import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getUserInfo } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  buildApiSnapshotKey,
  getApiSnapshot,
  setApiSnapshot,
  snapshotHeaders,
} from "@/lib/server/api-snapshots";

const PROFILE_TTL_SECONDS = 24 * 60 * 60;

interface InstagramProfileResponse {
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
}

// Profile lookup (username + avatar) for the campaign preview.
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
    const snapshotKey = buildApiSnapshotKey({
      source: "ig:profile",
      accountId: account.id,
    });
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    const cached = await getApiSnapshot<InstagramProfileResponse>(snapshotKey, {
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
        { headers: snapshotHeaders(PROFILE_TTL_SECONDS, "HIT") }
      );
    }

    const token = decryptToken(account.accessToken);
    const info = await getUserInfo(token);
    const data: InstagramProfileResponse = {
      username: info.username,
      name: info.name ?? null,
      profilePictureUrl: info.profile_picture_url ?? null,
    };
    const snapshot = await setApiSnapshot(
      {
        workspaceId,
        instagramAccountId: account.id,
        key: snapshotKey,
        source: "ig:profile",
      },
      data,
      PROFILE_TTL_SECONDS * 1000
    );

    return NextResponse.json(
      {
        success: true,
        data,
        snapshot: {
          status: "MISS",
          fetchedAt: snapshot.fetchedAt,
          expiresAt: snapshot.expiresAt,
        },
      },
      { headers: snapshotHeaders(PROFILE_TTL_SECONDS, "MISS") }
    );
  } catch (err) {
    console.error("[Instagram Profile] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
