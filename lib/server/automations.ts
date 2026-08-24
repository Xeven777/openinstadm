import { after } from "next/server";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { calculateCtr, normalizeTopKeywords } from "@/lib/tracking/analytics";
import { buildTrackedUrl } from "@/lib/tracking/message";
import { buildReportUrl, generateReportShareSlug } from "@/lib/reports/share";
import type { AutomationGetPayload } from "@/app/generated/prisma/models";

/**
 * Shared server-side query for the enriched campaign list.
 *
 * Used by both the API route handler (keeps its response byte-for-byte) and the
 * server-rendered Campaigns page, so the analytics aggregation lives in exactly
 * one place. Returns plain serializable objects (ISO timestamps, tracked/report
 * URLs baked in) so the result can be passed straight into a Client Component.
 */

export interface CampaignTrackedLink {
  id: string;
  slug: string;
  label: string | null;
  destinationUrl: string;
  trackedUrl: string;
  _count: { clicks: number };
}

export interface CampaignListItem {
  id: string;
  name: string;
  goal: string | null;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  wholeWordMatch: boolean;
  instagramAccountId: string;
  instagramAccount: { username: string; instagramId: string };
  reportShareSlug: string | null;
  reportShareEnabled: boolean;
  reportUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { dmLogs: number };
  trackedLinks: CampaignTrackedLink[];
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
    topKeywords: { keyword: string; count: number }[];
  };
}

const CAMPAIGN_INCLUDE = {
  instagramAccount: {
    select: { username: true, instagramId: true },
  },
  _count: {
    select: { dmLogs: true },
  },
  trackedLinks: {
    select: {
      id: true,
      slug: true,
      label: true,
      destinationUrl: true,
      _count: { select: { clicks: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

type CampaignWithRelations = AutomationGetPayload<{
  include: typeof CAMPAIGN_INCLUDE;
}>;

interface CampaignAnalyticsItem {
  sent: number;
  skipped: number;
  failed: number;
  clicks: number;
  topKeywords: { keyword: string; count: number }[];
}

/** Backfill missing share slugs off the critical path (after the response). */
function backfillMissingShareSlugs(automations: { id: string; reportShareSlug: string | null }[]) {
  const missingSlugs = automations.filter((automation) => !automation.reportShareSlug);
  if (missingSlugs.length === 0) return;
  after(async () => {
    try {
      await prisma.$transaction(
        missingSlugs.map((automation) =>
          prisma.automation.update({
            where: { id: automation.id },
            data: { reportShareSlug: generateReportShareSlug() },
            select: { id: true, reportShareSlug: true },
          })
        )
      );
    } catch (err) {
      console.error("[Automations] Share slug backfill failed:", err);
    }
  });
}

function buildAnalyticsMap(
  automations: { id: string }[],
  statusCounts: { automationId: string; status: string; _count: { _all: number } }[],
  clickCounts: { automationId: string; _count: { _all: number } }[],
  keywordCounts: { automationId: string; matchedKeyword: string | null; _count: { _all: number } }[]
): Map<string, CampaignAnalyticsItem> {
  const analytics = new Map<string, CampaignAnalyticsItem>();

  for (const automation of automations) {
    analytics.set(automation.id, {
      sent: 0,
      skipped: 0,
      failed: 0,
      clicks: 0,
      topKeywords: [],
    });
  }

  for (const row of statusCounts) {
    const item = analytics.get(row.automationId);
    if (!item) continue;
    const count = row._count._all;
    if (row.status === "SENT") item.sent += count;
    if (row.status === "FAILED") item.failed += count;
    if (row.status.startsWith("SKIPPED_")) item.skipped += count;
  }

  for (const row of clickCounts) {
    const item = analytics.get(row.automationId);
    if (item) item.clicks = row._count._all;
  }

  for (const automation of automations) {
    const item = analytics.get(automation.id);
    if (!item) continue;
    item.topKeywords = normalizeTopKeywords(
      keywordCounts
        .filter((row) => row.automationId === automation.id)
        .map((row) => ({
          matchedKeyword: row.matchedKeyword,
          _count: row._count._all,
        })),
      3
    );
  }

  return analytics;
}

function serializeCampaign(
  automation: CampaignWithRelations,
  item: CampaignAnalyticsItem
): CampaignListItem {
  return {
    ...automation,
    createdAt: automation.createdAt.toISOString(),
    updatedAt: automation.updatedAt.toISOString(),
    trackedLinks: automation.trackedLinks.map((link) => ({
      ...link,
      trackedUrl: buildTrackedUrl(link.slug),
    })),
    reportUrl: automation.reportShareSlug
      ? buildReportUrl(automation.reportShareSlug)
      : null,
    analytics: {
      ...item,
      ctr: calculateCtr(item.clicks, item.sent),
    },
  };
}

/**
 * Lightweight projection for the campaign post picker's "already used" badge.
 * Only the 4 columns the picker needs — no trackedLinks, no groupBy analytics.
 */
export interface UsedPostInfo {
  id: string;
  name: string;
  postId: string;
  instagramAccountId: string;
}

export async function getCampaignUsedPosts(
  workspaceId: string,
  instagramAccountId?: string | null
): Promise<UsedPostInfo[]> {
  "use cache";
  cacheLife({ stale: 900, revalidate: 900, expire: 7200 });
  cacheTag(`campaigns:${workspaceId}`);

  const accountFilter =
    instagramAccountId && instagramAccountId !== "all"
      ? { instagramAccountId }
      : {};

  return prisma.automation.findMany({
    where: { workspaceId, ...accountFilter, postId: { not: null } },
    select: {
      id: true,
      name: true,
      postId: true,
      instagramAccountId: true,
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<UsedPostInfo[]>;
}

/**
 * Invalidate the cached campaign list for a workspace.
 *
 * Call from every route that writes automations (create/update/delete/import,
 * next-reel cron) so the next read regenerates fresh. `{ expire: 0 }` is
 * route-handler-safe and expires the entry so the following read is a miss.
 */
export function invalidateCampaignsCache(workspaceId: string): void {
  revalidateTag(`campaigns:${workspaceId}`, { expire: 0 });
}

export async function getCampaignList(
  workspaceId: string,
  instagramAccountId?: string | null
): Promise<CampaignListItem[]> {
  "use cache";
  // 15 min stale / 2 h hard expiry — heavy aggregation (includes + 3 groupBy)
  // runs at most once per window; every mutation route invalidates the tag.
  cacheLife({ stale: 900, revalidate: 900, expire: 7200 });
  cacheTag(`campaigns:${workspaceId}`);

  const accountFilter =
    instagramAccountId && instagramAccountId !== "all"
      ? { instagramAccountId }
      : {};

  const automations = await prisma.automation.findMany({
    where: { workspaceId, ...accountFilter },
    include: CAMPAIGN_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  backfillMissingShareSlugs(automations);

  const [statusCounts, clickCounts, keywordCounts] = await Promise.all([
    prisma.dmLog.groupBy({
      by: ["automationId", "status"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    prisma.linkClick.groupBy({
      by: ["automationId"],
      where: { workspaceId },
      _count: { _all: true },
    }),
    prisma.dmLog.groupBy({
      by: ["automationId", "matchedKeyword"],
      where: { workspaceId, matchedKeyword: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const analytics = buildAnalyticsMap(
    automations,
    statusCounts,
    clickCounts,
    keywordCounts
  );

  return automations.map((automation) =>
    serializeCampaign(
      automation,
      analytics.get(automation.id) ?? {
        sent: 0,
        skipped: 0,
        failed: 0,
        clicks: 0,
        topKeywords: [],
      }
    )
  );
}

/**
 * Single-campaign view for the detail page.
 *
 * Queries one automation (plus its own analytics) instead of fetching the whole
 * campaign list and filtering client-side — the same shape as the list items,
 * so the detail page renders the identical summary without the N× list fetch.
 */
export async function getCampaignDetail(
  workspaceId: string,
  id: string
): Promise<CampaignListItem | null> {
  const automation = await prisma.automation.findFirst({
    where: { id, workspaceId },
    include: CAMPAIGN_INCLUDE,
  });
  if (!automation) return null;

  backfillMissingShareSlugs([automation]);

  const [statusCounts, clickCounts, keywordCounts] = await Promise.all([
    prisma.dmLog.groupBy({
      by: ["automationId", "status"],
      where: { workspaceId, automationId: id },
      _count: { _all: true },
    }),
    prisma.linkClick.groupBy({
      by: ["automationId"],
      where: { workspaceId, automationId: id },
      _count: { _all: true },
    }),
    prisma.dmLog.groupBy({
      by: ["automationId", "matchedKeyword"],
      where: { workspaceId, automationId: id, matchedKeyword: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const analytics = buildAnalyticsMap(
    [automation],
    statusCounts,
    clickCounts,
    keywordCounts
  );

  return serializeCampaign(
    automation,
    analytics.get(automation.id) ?? {
      sent: 0,
      skipped: 0,
      failed: 0,
      clicks: 0,
      topKeywords: [],
    }
  );
}