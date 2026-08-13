import { Suspense } from "react";
import { redirect } from "next/navigation";
import CampaignsList from "@/components/campaigns-list";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getCampaignList } from "@/lib/server/automations";
import type { AccountOption } from "@/components/account-select";

/**
 * Campaigns List Page (Server Component)
 *
 * Fetches the enriched campaign list and the account dropdown directly from the
 * database on every render — no client fetch, no JSON round-trip. Interactivity
 * (filtering, toggles, delete, duplicate, reel lightbox) lives in the
 * `CampaignsList` client island, which receives this data as props.
 *
 * Under cacheComponents the session lookup + DB reads stream inside a Suspense
 * boundary at request time.
 */
export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="bg-muted rounded p-8 h-64" />}>
      <CampaignsContent />
    </Suspense>
  );
}

async function CampaignsContent() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/login");
  }

  const [campaigns, instagramAccounts] = await Promise.all([
    getCampaignList(workspaceId),
    prisma.instagramAccount.findMany({
      where: { workspaceId },
      orderBy: { connectedAt: "desc" },
      select: { id: true, username: true, instagramId: true, name: true },
    }),
  ]);

  const accounts: AccountOption[] = instagramAccounts.map((account) => ({
    id: account.id,
    username: account.username,
    instagramId: account.instagramId,
    name: account.name,
  }));

  return <CampaignsList campaigns={campaigns} accounts={accounts} />;
}
