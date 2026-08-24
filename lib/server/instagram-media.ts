import type { InstagramAccount } from "@/app/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import {
  getAllUserMedia,
  getUserInfo,
  getUserMedia,
  MEDIA_THUMB_FIELDS,
  type InstagramMedia,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  buildApiSnapshotKey,
  getApiSnapshot,
  setApiSnapshot,
} from "@/lib/server/api-snapshots";

export const RECENT_POSTS_TTL_SECONDS = 60 * 60;
export const ALL_POSTS_TTL_SECONDS = 2 * 60 * 60;
export const PROFILE_TTL_SECONDS = 24 * 60 * 60;

export interface SnapshotResult<T> {
  data: T;
  snapshot: {
    status: "HIT" | "MISS";
    fetchedAt: string;
    expiresAt: string;
  };
}

/**
 * Cache tags covering every variant (recent/all, any limit) for one account, so
 * a manual refresh or token change can expire them all with one revalidateTag.
 */
export function postsSnapshotTag(accountId: string): string {
  return `ig:posts:${accountId}`;
}

export function profileSnapshotTag(accountId: string): string {
  return `ig:profile:${accountId}`;
}

/* ------------------------------------------------------------------ Posts */

export interface PostsLoaderParams {
  workspaceId: string;
  account: Pick<InstagramAccount, "id" | "accessToken">;
  /** `all=true` paginates the full library (campaign post picker). */
  loadAll: boolean;
  /** Recent-page size, already clamped to 1..50 by the caller. */
  limit: number;
}

/**
 * Shared server-side loader for `/api/instagram/posts`, layered on top of the
 * durable Postgres snapshot with a `use cache` in-process front-cache.
 *
 * The refresh path deliberately bypasses this cache: the route expires the tag
 * and calls `loadPostsDataImpl` directly, so a manual refresh always hits Meta
 * (see app/api/instagram/posts/route.ts).
 */
export async function loadPostsData(
  params: PostsLoaderParams
): Promise<SnapshotResult<InstagramMedia[]>> {
  "use cache";
  // Front-cache capped at the snapshot TTLs (1h recent / 2h all-time) so it can
  // never serve data meaningfully older than the snapshot would.
  cacheLife({
    stale: 60,
    revalidate: 3600,
    expire: 7200,
  });
  cacheTag(postsSnapshotTag(params.account.id));
  return loadPostsDataImpl({ ...params, refresh: false });
}

/**
 * Un-cached implementation used by `loadPostsData` and the manual-refresh path.
 */
export async function loadPostsDataImpl(
  params: PostsLoaderParams & { refresh?: boolean }
): Promise<SnapshotResult<InstagramMedia[]>> {
  const { workspaceId, account, loadAll, limit, refresh = false } = params;
  const ttlSeconds = loadAll
    ? ALL_POSTS_TTL_SECONDS
    : RECENT_POSTS_TTL_SECONDS;
  const snapshotKey = buildApiSnapshotKey({
    source: "ig:posts",
    accountId: account.id,
    params: loadAll ? { all: true, max: 300, v: 2 } : { limit },
  });

  const cached = await getApiSnapshot<InstagramMedia[]>(snapshotKey, {
    bypass: refresh,
  });
  if (cached) {
    return {
      data: cached.data,
      snapshot: {
        status: "HIT",
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
      },
    };
  }

  const accessToken = decryptToken(account.accessToken);
  // The picker's full-library fetch needs both `thumbnail_url` (VIDEO) and
  // `media_url` (IMAGE / CAROUSEL). `thumbnail_url` is null for images, so
  // omitting `media_url` blanks the grid. The picker only renders an <img>
  // with `thumbnail_url ?? media_url` (no <video> mount).
  const posts = loadAll
    ? await getAllUserMedia(accessToken, 300, MEDIA_THUMB_FIELDS)
    : await getUserMedia(accessToken, limit);

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

  return {
    data: posts,
    snapshot: {
      status: "MISS",
      fetchedAt: snapshot.fetchedAt,
      expiresAt: snapshot.expiresAt,
    },
  };
}

/* ---------------------------------------------------------------- Profile */

export interface ProfileLoaderParams {
  workspaceId: string;
  account: Pick<InstagramAccount, "id" | "accessToken">;
}

export interface InstagramProfileResponse {
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
}

/**
 * Shared server-side loader for `/api/instagram/profile` (username + avatar for
 * campaign previews), layered on the durable snapshot with a `use cache`
 * front-cache.
 *
 * The refresh path deliberately bypasses this cache: the route expires the tag
 * and calls `loadProfileDataImpl` directly (see app/api/instagram/profile/route.ts).
 */
export async function loadProfileData(
  params: ProfileLoaderParams
): Promise<SnapshotResult<InstagramProfileResponse>> {
  "use cache";
  // Profile photos/usernames rarely change — 24h snapshot TTL, so the front-cache
  // revalidates at 24h and expires at 48h.
  cacheLife({
    stale: 3600,
    revalidate: 86400,
    expire: 172800,
  });
  cacheTag(profileSnapshotTag(params.account.id));
  return loadProfileDataImpl({ ...params, refresh: false });
}

/**
 * Un-cached implementation used by `loadProfileData` and the manual-refresh path.
 */
export async function loadProfileDataImpl(
  params: ProfileLoaderParams & { refresh?: boolean }
): Promise<SnapshotResult<InstagramProfileResponse>> {
  const { workspaceId, account, refresh = false } = params;
  const snapshotKey = buildApiSnapshotKey({
    source: "ig:profile",
    accountId: account.id,
  });

  const cached = await getApiSnapshot<InstagramProfileResponse>(snapshotKey, {
    bypass: refresh,
  });
  if (cached) {
    return {
      data: cached.data,
      snapshot: {
        status: "HIT",
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
      },
    };
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

  return {
    data,
    snapshot: {
      status: "MISS",
      fetchedAt: snapshot.fetchedAt,
      expiresAt: snapshot.expiresAt,
    },
  };
}
