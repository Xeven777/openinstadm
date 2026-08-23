import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import CampaignDetail from "@/components/campaign-detail";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getCampaignDetail } from "@/lib/server/automations";

/**
 * Campaign Detail Page (Server Component)
 *
 * Loads the single campaign directly from the database via `getCampaignDetail`
 * — no fetching the whole campaign list and filtering client-side. Interactivity
 * (tabs, toggle, live avatar/post thumbnails) lives in the `CampaignDetail`
 * client island, which receives the campaign as a prop.
 *
 * Under cacheComponents the `params` promise and session lookup are awaited
 * inside a Suspense boundary so the shell can still prerender.
 */
export default function CampaignDetailPage(props: PageProps<"/campaigns/[id]">) {
  return (
    <Suspense fallback={<div className="bg-muted rounded p-8 h-64" />}>
      <CampaignDetailContent params={props.params} />
    </Suspense>
  );
}

async function CampaignDetailContent({
  params,
}: {
  params: PageProps<"/campaigns/[id]">["params"];
}) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/login");

  const { id } = await params;
  const campaign = await getCampaignDetail(workspaceId, id);

  if (!campaign) {
    return (
      <div className="bg-muted rounded p-8 text-center">
        <p className="text-sm text-muted-foreground">Campaign not found.</p>
        <Link
          href="/campaigns"
          className="mt-4 inline-block rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Back to campaigns
        </Link>
      </div>
    );
  }

  return <CampaignDetail campaign={campaign} />;
}
