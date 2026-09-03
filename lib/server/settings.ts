import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import type { InstagramAccountStat } from "@/lib/server/stats";

/**
 * Invalidate the cached settings payload for a workspace.
 *
 * Call this from any route that mutates Instagram connections (connect,
 * disconnect) so the next navigation serves fresh data.
 */
export function invalidateSettingsCache(workspaceId: string): void {
  revalidateTag(`settings:${workspaceId}`, { expire: 0 });
  revalidateTag(`sidebar-accounts:${workspaceId}`, { expire: 0 });
}

/**
 * Cached account list for the sidebar shell.
 *
 * Only returns the fields the sidebar needs (username, count). Cached
 * separately from the full settings payload so sidebar renders are cheap
 * and don't pull in workspace DM counts.
 */
export async function getSidebarAccounts(
  workspaceId: string
): Promise<{ username: string | null; count: number }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(`sidebar-accounts:${workspaceId}`);

  const accounts = await prisma.instagramAccount.findMany({
    where: { workspaceId },
    orderBy: { connectedAt: "desc" },
    select: { username: true },
  });

  return {
    username: accounts[0]?.username ?? null,
    count: accounts.length,
  };
}

/**
 * Cached account list shared by the /logs and /campaigns account filters.
 *
 * Same connection data as getSettingsData's account rows (the fields the
 * filter dropdowns need), cached under the sidebar-accounts tag so the
 * existing connect/disconnect invalidation covers it too.
 */
export interface WorkspaceAccountOption {
  id: string;
  username: string;
  instagramId: string;
  name: string | null;
}

export async function getWorkspaceAccounts(
  workspaceId: string
): Promise<WorkspaceAccountOption[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(`sidebar-accounts:${workspaceId}`);

  return prisma.instagramAccount.findMany({
    where: { workspaceId },
    orderBy: { connectedAt: "desc" },
    select: { id: true, username: true, instagramId: true, name: true },
  });
}

/**
 * Shared server-side query for the settings page.
 *
 * Cached for 30s stale — fast on return navigations while still picking up
 * new connections and disconnects within a minute. Mutations call
 * router.refresh() which bypasses the cache for that render.
 */

export interface SettingsData {
  workspace: { name: string; dmsSentThisPeriod: number } | null;
  instagramAccounts: InstagramAccountStat[];
}

export async function getSettingsData(
  workspaceId: string
): Promise<SettingsData> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(`settings:${workspaceId}`);

  const [workspace, instagramAccounts] = await Promise.all([
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
        fallbackReplyEnabled: true,
        fallbackReplyMessage: true,
      },
    }),
  ]);

  return {
    workspace,
    instagramAccounts: instagramAccounts.map((account) => ({
      ...account,
      tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    })),
  };
}
