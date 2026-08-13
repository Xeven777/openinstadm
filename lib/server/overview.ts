import type { InstagramAccount } from "@/app/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import {
  getAllUserMedia,
  getMediaInsights,
  PermissionError,
  type InstagramMedia,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import {
  ensureFollowerHistory,
  getFollowerHistory,
  type FollowerHistoryPoint,
} from "@/lib/reports/follower-history";
import {
  buildApiSnapshotKey,
  getApiSnapshot,
  setApiSnapshot,
} from "@/lib/server/api-snapshots";

// Safety ceiling for "all time": bounds pagination and the number of
// per-media insight requests so we can't hammer the API or time out.
export const OVERVIEW_MAX_POSTS = 500;

// How many insight requests to run at once.
const INSIGHTS_CONCURRENCY = 8;

export const RECENT_OVERVIEW_TTL_SECONDS = 60 * 60;
export const ALL_OVERVIEW_TTL_SECONDS = 2 * 60 * 60;

/** Map over items with a bounded number of in-flight async operations. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export interface OverviewPost {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaType: string;
  timestamp: string;
  views: number | null;
  reach: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
}

export interface OverviewResponse {
  account: { id: string; username: string };
  accounts: Array<{ id: string; username: string; instagramId: string }>;
  requestedCount: "all" | number;
  truncated: boolean;
  insightsAvailable: boolean;
  /** Current follower total, or null if Instagram did not return it. */
  followers: number | null;
  /**
   * Follower total per day, ascending. Independent of the selected post range —
   * limited to what has been snapshotted plus any 30-day insights backfill.
   */
  followerHistory: FollowerHistoryPoint[];
  totals: {
    posts: number;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    saved: number;
    shares: number;
    interactions: number;
  };
  posts: OverviewPost[];
}

export interface OverviewSnapshotInfo {
  status: "HIT" | "MISS";
  fetchedAt: string;
  expiresAt: string;
}

function isVideoLike(media: InstagramMedia): boolean {
  return (
    media.media_product_type === "REELS" || media.media_type === "VIDEO"
  );
}

async function getWorkspaceAccountOptions(workspaceId: string) {
  return prisma.instagramAccount.findMany({
    where: { workspaceId },
    orderBy: { connectedAt: "desc" },
    select: { id: true, username: true, instagramId: true },
  });
}

/**
 * `count` is either "all" or a positive integer (last N posts). Unknown or
 * malformed values fall back to 50, matching the API's default range.
 */
export function parseOverviewCount(
  value: string | null | undefined
): "all" | number {
  if (value === "all") return "all";
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : 50;
}

export type OverviewLoaderParams = {
  workspaceId: string;
  account: Pick<InstagramAccount, "id" | "instagramId" | "username" | "accessToken">;
  count: "all" | number;
};

export type OverviewLoaderResult = {
  data: OverviewResponse;
  snapshot: OverviewSnapshotInfo;
};

/**
 * Cache tag covering every overview range for one account.
 *
 * Account-scoped (not per-range) so a manual refresh or token change can expire
 * all ranges at once with a single `revalidateTag`.
 */
export function overviewSnapshotTag(accountId: string): string {
  return `ig:overview:${accountId}`;
}

/**
 * Shared server-side loader for the Instagram Overview page.
 *
 * Used by both the API route handler and the server-rendered Overview page.
 * Heavy Meta work (paginated media + per-post insights + follower history) runs
 * once per snapshot TTL; repeat reads are served from the durable `ApiSnapshot`
 * row, with this `use cache` layer as a fast in-process front-cache. The
 * workspace's account list is always re-fetched so a newly connected account
 * appears in the filter even while the snapshot itself is cached.
 *
 * The refresh path deliberately bypasses this cache: the API route calls
 * `revalidateTag(overviewSnapshotTag(...), { expire: 0 })` and then
 * `loadOverviewDataImpl` directly (see app/api/instagram/overview/route.ts).
 */
export async function loadOverviewData(
  params: OverviewLoaderParams
): Promise<OverviewLoaderResult> {
  "use cache";
  // The durable Postgres snapshot governs freshness (1h recent / 2h all-time),
  // so this in-process front-cache revalidates at 1h and expires at 2h — it
  // can never serve data meaningfully older than the snapshot would. The 60s
  // stale keeps return navigations instant while still checking the server on
  // frequent revisits.
  cacheLife({
    stale: 60,
    revalidate: 3600,
    expire: 7200,
  });
  cacheTag(overviewSnapshotTag(params.account.id));
  return loadOverviewDataImpl({ ...params, refresh: false });
}

/**
 * Un-cached implementation used by `loadOverviewData` and the manual-refresh
 * path (which must always hit Meta, never serve a cached copy).
 */
export async function loadOverviewDataImpl(
  params: OverviewLoaderParams & { refresh?: boolean }
): Promise<OverviewLoaderResult> {
  const { workspaceId, account, count, refresh = false } = params;
  const target =
    count === "all" ? OVERVIEW_MAX_POSTS : Math.min(count, OVERVIEW_MAX_POSTS);
  const ttlSeconds =
    count === "all" ? ALL_OVERVIEW_TTL_SECONDS : RECENT_OVERVIEW_TTL_SECONDS;
  const snapshotKey = buildApiSnapshotKey({
    source: "ig:overview",
    accountId: account.id,
    params: { count },
  });

  const cached = await getApiSnapshot<OverviewResponse>(snapshotKey, {
    bypass: refresh,
  });
  if (cached) {
    return {
      data: {
        ...cached.data,
        accounts: await getWorkspaceAccountOptions(workspaceId),
      },
      snapshot: {
        status: "HIT",
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
      },
    };
  }

  const accessToken = decryptToken(account.accessToken);
  const media = await getAllUserMedia(accessToken, target);
  const truncated = media.length >= OVERVIEW_MAX_POSTS;

  // Likes and comments come free with basic media fields. Views / reach /
  // saved / shares require the insights permission, so fetch them per media
  // (bounded concurrency) and degrade gracefully if the token was granted
  // before that scope.
  let insightsAvailable = false;
  let permissionDenied = false;

  const insights = await mapWithConcurrency(
    media,
    INSIGHTS_CONCURRENCY,
    async (m) => {
      const metrics = isVideoLike(m)
        ? ["views", "reach", "saved", "shares", "total_interactions"]
        : ["reach", "saved", "shares", "total_interactions"];
      try {
        const data = await getMediaInsights(accessToken, m.id, metrics);
        insightsAvailable = true;
        return data;
      } catch (err) {
        if (err instanceof PermissionError) permissionDenied = true;
        return null;
      }
    }
  );

  const posts: OverviewPost[] = media.map((m, i) => {
    const ins = insights[i];
    const likes = m.like_count ?? 0;
    const comments = m.comments_count ?? 0;
    return {
      id: m.id,
      caption: m.caption?.trim().slice(0, 120) ?? null,
      permalink: m.permalink ?? null,
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      mediaType: m.media_product_type ?? m.media_type,
      timestamp: m.timestamp,
      views: ins?.views ?? null,
      reach: ins?.reach ?? null,
      likes,
      comments,
      saved: ins?.saved ?? null,
      shares: ins?.shares ?? null,
    };
  });

  const totals = posts.reduce(
    (acc, p) => {
      acc.posts += 1;
      acc.views += p.views ?? 0;
      acc.reach += p.reach ?? 0;
      acc.likes += p.likes;
      acc.comments += p.comments;
      acc.saved += p.saved ?? 0;
      acc.shares += p.shares ?? 0;
      acc.interactions += p.likes + p.comments + (p.saved ?? 0) + (p.shares ?? 0);
      return acc;
    },
    {
      posts: 0,
      views: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      saved: 0,
      shares: 0,
      interactions: 0,
    }
  );

  // Followers is a point-in-time figure and deliberately not part of
  // `totals`, which sums over the selected posts. A failure here must not
  // take down the rest of the overview.
  let followers: number | null = null;
  let followerHistory: FollowerHistoryPoint[] = [];
  try {
    followers = await ensureFollowerHistory(
      { id: account.id, instagramId: account.instagramId },
      accessToken
    );
    followerHistory = await getFollowerHistory(account.id);
  } catch (err) {
    console.warn(
      "[Instagram Overview] Follower history unavailable:",
      err instanceof Error ? err.message : err
    );
  }

  const data: OverviewResponse = {
    account: { id: account.id, username: account.username },
    accounts: await getWorkspaceAccountOptions(workspaceId),
    requestedCount: count,
    truncated,
    insightsAvailable: insightsAvailable && !permissionDenied,
    followers,
    followerHistory,
    totals,
    posts,
  };

  const snapshot = await setApiSnapshot(
    {
      workspaceId,
      instagramAccountId: account.id,
      key: snapshotKey,
      source: "ig:overview",
    },
    data,
    ttlSeconds * 1000
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
