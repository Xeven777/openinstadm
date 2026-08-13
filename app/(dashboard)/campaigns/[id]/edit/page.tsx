import { Suspense } from "react";
import EditCampaignBuilder from "@/components/edit-campaign-builder";

/**
 * Edit Campaign Page (Server Component)
 *
 * The builder reads the campaign id from the route, so under cacheComponents
 * the read suspends inside a Suspense boundary and the shell can still
 * prerender.
 */
export default function EditCampaignPage() {
  return (
    <Suspense fallback={<div className="bg-muted rounded p-8 h-64" />}>
      <EditCampaignBuilder />
    </Suspense>
  );
}
