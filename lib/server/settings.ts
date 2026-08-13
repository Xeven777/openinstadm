import { prisma } from "@/lib/db/client";
import type { InstagramAccountStat } from "@/lib/server/stats";

/**
 * Shared server-side query for the settings page.
 *
 * Two indexed reads (workspace by PK, accounts by workspaceId) — cheap enough
 * to run on every navigation with no TTL cache, so mutation-then-navigation
 * flows (invite, disconnect) always paint fresh data after `router.refresh()`.
 */

export interface SettingsData {
  workspace: { name: string; dmsSentThisPeriod: number } | null;
  instagramAccounts: InstagramAccountStat[];
}

export async function getSettingsData(
  workspaceId: string
): Promise<SettingsData> {
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
