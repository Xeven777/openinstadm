import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import {
  calculateCtr,
  normalizeTopKeywords,
  summarizeDmStatuses,
} from "@/lib/tracking/analytics";

/**
 * Invalidate every cached dashboard payload for a workspace.
 *
 * Call this from any route that mutates the data the dashboard tiles read
 * (campaign create/update/delete/import, Instagram connect/disconnect), so the
 * next navigation doesn't serve stale counts. Uses `revalidateTag` with
 * `{ expire: 0 }` — the next read is a blocking cache miss that regenerates
 * fresh data synchronously, the same contract the old in-process cache clear
 * had. Tag and cache key live together in `getDashboardStats` below so they
 * can never drift apart.
 */
export function invalidateWorkspaceStats(workspaceId: string): void {
  revalidateTag(`dash:stats:${workspaceId}`, { expire: 0 });
}

/**
 * Shared server-side query for the dashboard home page.
 *
 * Used by both the API route handler and the server-rendered Dashboard page, so
 * the aggregation lives in exactly one place. All Dates are converted to ISO
 * strings so the result is plain serializable data that can be JSON-serialized
 * (API), cached by `use cache`, or passed straight into the render tree.
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

export interface DashboardSummaryData {
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
}

export interface DashboardInsightsData {
  topKeywords: { keyword: string; count: number }[];
  dailyDMs: { date: string; count: number }[];
  recentLogs: DashboardRecentLog[];
}

/**
 * Cheap half of the dashboard: greeting, account list/filter, and the six tile
 * counts. All small indexed reads — 120s stale like the old combined TTL.
 * Cached under the same dash:stats tag as the insights half, so
 * invalidateWorkspaceStats() busts both. Keyed on (workspace, user, account)
 * so the per-user greeting name never leaks across members.
 */
export async function getDashboardSummary(
  workspaceId: string,
  userId: string | null,
  selectedAccountId: string | null,
): Promise<DashboardSummaryData> {
  "use cache";
  cacheLife({ stale: 120, revalidate: 120, expire: 3600 });
  cacheTag(`dash:stats:${workspaceId}`);
  return computeDashboardSummary(workspaceId, userId, selectedAccountId);
}

/**
 * Expensive half of the dashboard: 7-day chart series, top keywords, recent
 * activity. Three heavier reads (a full week of timestamps + grouped keywords +
 * the 10 latest logs) — 5 min stale, matching the worker-written data cadence.
 * Shared across workspace members (no per-user data here), so one entry per
 * workspace instead of one per member.
 */
export async function getDashboardInsights(
  workspaceId: string,
  selectedAccountId: string | null,
): Promise<DashboardInsightsData> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 7200 });
  cacheTag(`dash:stats:${workspaceId}`);
  return computeDashboardInsights(workspaceId, selectedAccountId);
}

/**
 * Full dashboard payload for the API route — composes the two cached halves so
 * the response shape is unchanged.
 */
export async function getDashboardStats(
  workspaceId: string,
  userId: string | null,
  selectedAccountId: string | null,
): Promise<DashboardStatsData> {
  const [summary, insights] = await Promise.all([
    getDashboardSummary(workspaceId, userId, selectedAccountId),
    getDashboardInsights(workspaceId, selectedAccountId),
  ]);
  return { ...summary, ...insights };
}

async function computeDashboardSummary(
  workspaceId: string,
  userId: string | null,
  selectedAccountId: string | null,
): Promise<DashboardSummaryData> {
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
    user,
    contactRows,
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
  ]);

  const monthlyStatusSummary = summarizeDmStatuses(
    dmStatusCountsThisMonth.map((row) => ({
      status: row.status,
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
  };
}

async function computeDashboardInsights(
  workspaceId: string,
  selectedAccountId: string | null,
): Promise<DashboardInsightsData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const accountFilter = selectedAccountId
    ? { instagramAccountId: selectedAccountId }
    : {};

  const [topKeywordRows, recentLogs, weekLogs] = await Promise.all([
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
    // The 7-day series: a single lean select of just the timestamps, bucketed
    // per day in JS. Bucketing in JS (rather than SQL date_trunc) keeps the
    // exact app-local day boundaries the chart always used, regardless of the
    // database session timezone. Only createdAt crosses the wire.
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

  const topKeywords = normalizeTopKeywords(
    topKeywordRows.map((row) => ({
      matchedKeyword: row.matchedKeyword,
      _count: row._count._all,
    })),
  );

  return {
    topKeywords,
    dailyDMs,
    recentLogs: recentLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
