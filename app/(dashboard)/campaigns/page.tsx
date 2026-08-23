import { Suspense } from "react";
import { redirect } from "next/navigation";
import CampaignsList from "@/components/campaigns-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getCampaignList } from "@/lib/server/automations";
import { getWorkspaceAccounts } from "@/lib/server/settings";
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
function CampaignsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-muted/50 p-4"
        >
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-3 h-4 w-64" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<CampaignsSkeleton />}>
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
    getWorkspaceAccounts(workspaceId),
  ]);

  const accounts: AccountOption[] = instagramAccounts.map((account) => ({
    id: account.id,
    username: account.username,
    instagramId: account.instagramId,
    name: account.name,
  }));

  return <CampaignsList campaigns={campaigns} accounts={accounts} />;
}
