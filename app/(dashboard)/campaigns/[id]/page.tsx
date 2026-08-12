import { redirect } from "next/navigation";
import Link from "next/link";
import CampaignDetail from "@/components/campaign-detail";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getCampaignDetail } from "@/lib/server/automations";

/**
 * Campaign Detail Page (Server Component)
 *
 * Loads the single campaign directly from the database via `getCampaignDetail`
 * — no fetching the whole campaign list and filtering client-side. Interactivity
 * (tabs, toggle, live avatar/post thumbnails) lives in the `CampaignDetail`
 * client island, which receives the campaign as a prop.
 */

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: PageProps<"/campaigns/[id]">) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/login");

  const { id } = await params;
  const campaign = await getCampaignDetail(workspaceId, id);

  if (!campaign) {
    return (
      <div className="panel rounded p-8 text-center">
        <p className="text-sm text-muted">Campaign not found.</p>
        <Link
          href="/campaigns"
          className="mt-4 inline-block rounded border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Back to campaigns
        </Link>
      </div>
    );
  }

  return <CampaignDetail campaign={campaign} />;
}
