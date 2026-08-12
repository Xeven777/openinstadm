import { after } from "next/server";
import { prisma } from "@/lib/db/client";
import { calculateCtr, normalizeTopKeywords } from "@/lib/tracking/analytics";
import { buildTrackedUrl } from "@/lib/tracking/message";
import { buildReportUrl, generateReportShareSlug } from "@/lib/reports/share";

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

export async function getCampaignList(
  workspaceId: string,
  instagramAccountId?: string | null
): Promise<CampaignListItem[]> {
  const accountFilter =
    instagramAccountId && instagramAccountId !== "all"
      ? { instagramAccountId }
      : {};

  const automations = await prisma.automation.findMany({
    where: { workspaceId, ...accountFilter },
    include: {
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
    },
    orderBy: { createdAt: "desc" },
  });

  // Legacy rows (created before share slugs existed) get a slug backfilled off
  // the critical path: the writes run after the response is sent, so the query
  // stays fast instead of doing one update per campaign here. Rows that lack a
  // slug simply return `reportUrl: null` until the backfill lands.
  const missingSlugs = automations.filter((automation) => !automation.reportShareSlug);
  if (missingSlugs.length > 0) {
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

  const analytics = new Map<
    string,
    {
      sent: number;
      skipped: number;
      failed: number;
      clicks: number;
      topKeywords: { keyword: string; count: number }[];
    }
  >();

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

  return automations.map((automation) => {
    const item = analytics.get(automation.id) ?? {
      sent: 0,
      skipped: 0,
      failed: 0,
      clicks: 0,
      topKeywords: [],
    };

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
  });
}