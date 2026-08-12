import { prisma } from "@/lib/db/client";
import { clearCachedByPrefix, getCached, setCached } from "@/lib/server-cache";
import {
  calculateCtr,
  normalizeTopKeywords,
  summarizeDmStatuses,
} from "@/lib/tracking/analytics";

// Dashboard tiles are fine a bit stale; 120s matches the old client-side SWR
// maxAge. The dashboard RSC re-renders on every navigation, so without this
// every visit would re-run ~16 queries against the DB.
const STATS_TTL_MS = 120_000;

/**
 * Drop every cached dashboard payload for a workspace.
 *
 * Call this from any route that mutates the data the dashboard tiles read
 * (campaign create/update/delete/import, Instagram connect/disconnect), so the
 * next navigation doesn't serve stale counts for the rest of the TTL window.
 * Defined here rather than next to `clearCachedByPrefix` so the invalidation
 * prefix can never drift from the actual cache-key scheme above.
 */
export function invalidateWorkspaceStats(workspaceId: string): void {
  clearCachedByPrefix(`dash:stats:${workspaceId}:`);
}

/**
 * Shared server-side query for the dashboard home page.
 *
 * Used by both the API route handler (settings page still consumes its JSON
 * response) and the server-rendered Dashboard page, so the aggregation lives in
 * exactly one place. All Dates are converted to ISO strings so the result is
 * plain serializable data that can be JSON-serialized (API) or passed straight
 * into the render tree.
 */

export interface InstagramAccountStat {
  id: string;
  username: string;
  instagramId: string;
  name: string | null;
  tokenExpiresAt: string | null;
  webhookSubscribed: boolean;
}

export interface DashboardRecentLog {
  id: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  createdAt: string;
  automation: { name: string };
  instagramAccount?: { username: string };
}

export interface DashboardStatsData {
  userName: string | null;
  contactsCount: number;
  workspace: { name: string; dmsSentThisPeriod: number } | null;
  instagramAccount: InstagramAccountStat | null;
  instagramAccounts: InstagramAccountStat[];
  selectedInstagramAccountId: string | null;
  totalAutomations: number;
  activeAutomations: number;
  dmsSentToday: number;
  dmsSentWeek: number;
  dmsSentMonth: number;
  dmsSkippedMonth: number;
  dmsFailedMonth: number;
  totalDMs: number;
  clicksThisMonth: number;
  totalClicks: number;
  ctrThisMonth: number;
  topKeywords: { keyword: string; count: number }[];
  dailyDMs: { date: string; count: number }[];
  recentLogs: DashboardRecentLog[];
}

export async function getDashboardStats(
  workspaceId: string,
  userId: string | null,
  selectedAccountId: string | null,
): Promise<DashboardStatsData> {
  // Keyed by user too: the greeting name (userName) is per-user, so two
  // members of an agency workspace must not see each other's name for 120s.
  const cacheKey = `dash:stats:${workspaceId}:${userId ?? "anon"}:${selectedAccountId ?? "all"}`;
  const cached = getCached<DashboardStatsData>(cacheKey);
  if (cached) return cached;

  const data = await computeDashboardStats(
    workspaceId,
    userId,
    selectedAccountId,
  );
  setCached(cacheKey, data, STATS_TTL_MS);
  return data;
}

async function computeDashboardStats(
  workspaceId: string,
  userId: string | null,
  selectedAccountId: string | null,
): Promise<DashboardStatsData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const accountFilter = selectedAccountId
    ? { instagramAccountId: selectedAccountId }
    : {};

  // The most recently connected account is the first element of the ordered
  // list below — no need for a separate findFirst query.
  const [
    workspace,
    instagramAccounts,
    totalAutomations,
    activeAutomations,
    dmsSentToday,
    dmsSentWeek,
    dmsSentMonth,
    totalDMs,
    dmStatusCountsThisMonth,
    clicksThisMonth,
    totalClicks,
    topKeywordRows,
    recentLogs,
    user,
    contactRows,
    weekLogs,
  ] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        dmsSentThisPeriod: true,
      },
    }),
    prisma.instagramAccount.findMany({
      where: { workspaceId },
      orderBy: { connectedAt: "desc" },
      select: {
        id: true,
        username: true,
        instagramId: true,
        name: true,
        tokenExpiresAt: true,
        webhookSubscribed: true,
      },
    }),
    prisma.automation.count({ where: { workspaceId, ...accountFilter } }),
    prisma.automation.count({
      where: { workspaceId, isActive: true, ...accountFilter },
    }),
    prisma.dmLog.count({
      where: {
        workspaceId,
        status: "SENT",
        createdAt: { gte: todayStart },
        ...accountFilter,
      },
    }),
    prisma.dmLog.count({
      where: {
        workspaceId,
        status: "SENT",
        createdAt: { gte: weekStart },
        ...accountFilter,
      },
    }),
    prisma.dmLog.count({
      where: {
        workspaceId,
        status: "SENT",
        createdAt: { gte: monthStart },
        ...accountFilter,
      },
    }),
    prisma.dmLog.count({
      where: { workspaceId, status: "SENT", ...accountFilter },
    }),
    prisma.dmLog.groupBy({
      by: ["status"],
      where: { workspaceId, createdAt: { gte: monthStart }, ...accountFilter },
      _count: { _all: true },
    }),
    prisma.linkClick.count({
      where: { workspaceId, createdAt: { gte: monthStart }, ...accountFilter },
    }),
    prisma.linkClick.count({ where: { workspaceId, ...accountFilter } }),
    prisma.dmLog.groupBy({
      by: ["matchedKeyword"],
      where: { workspaceId, matchedKeyword: { not: null }, ...accountFilter },
      _count: { _all: true },
    }),
    prisma.dmLog.findMany({
      where: { workspaceId, ...accountFilter },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        automation: { select: { name: true } },
        instagramAccount: { select: { username: true } },
      },
    }),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
      : Promise.resolve(null),
    // Distinct people who have interacted, counted as "contacts". Aggregated
    // in SQL (one row per commenter) instead of streaming every DmLog row.
    prisma.dmLog.groupBy({
      by: ["commenterId"],
      where: { workspaceId, ...accountFilter },
      _count: { _all: true },
    }),
    // The 7-day series used to be 7 sequential count queries; now it's a single
    // lean select of just the timestamps, bucketed per day in JS. Bucketing in
    // JS (rather than SQL date_trunc) keeps the exact app-local day boundaries
    // the chart always used, regardless of the database session timezone. Only
    // createdAt crosses the wire, so the payload stays small. Run inside the
    // same Promise.all so it doesn't add a sequential round trip.
    prisma.dmLog.findMany({
      where: {
        workspaceId,
        status: "SENT",
        createdAt: { gte: weekStart },
        ...accountFilter,
      },
      select: { createdAt: true },
    }),
  ]);

  const countsByDay = new Map<string, number>();
  for (const log of weekLogs) {
    const key = log.createdAt.toDateString();
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const dailyDMs: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - i);
    dailyDMs.push({
      date: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      count: countsByDay.get(dayStart.toDateString()) ?? 0,
    });
  }

  const monthlyStatusSummary = summarizeDmStatuses(
    dmStatusCountsThisMonth.map((row) => ({
      status: row.status,
      _count: row._count._all,
    })),
  );
  const topKeywords = normalizeTopKeywords(
    topKeywordRows.map((row) => ({
      matchedKeyword: row.matchedKeyword,
      _count: row._count._all,
    })),
  );

  const firstName =
    user?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || null;

  const serializedAccounts: InstagramAccountStat[] = instagramAccounts.map(
    (account) => ({
      ...account,
      tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    }),
  );

  return {
    userName: firstName,
    contactsCount: contactRows.length,
    workspace,
    instagramAccount: serializedAccounts[0] ?? null,
    instagramAccounts: serializedAccounts,
    selectedInstagramAccountId: selectedAccountId,
    totalAutomations,
    activeAutomations,
    dmsSentToday,
    dmsSentWeek,
    dmsSentMonth,
    dmsSkippedMonth: monthlyStatusSummary.skipped,
    dmsFailedMonth: monthlyStatusSummary.failed,
    totalDMs,
    clicksThisMonth,
    totalClicks,
    ctrThisMonth: calculateCtr(clicksThisMonth, dmsSentMonth),
    topKeywords,
    dailyDMs,
    recentLogs: recentLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
