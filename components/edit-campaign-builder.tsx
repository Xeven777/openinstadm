"use client";

/**
 * Edit Campaign Builder — interactive island
 *
 * Thin wrapper that reads the campaign id from the route and hands it to the
 * builder. Kept separate from the page so the `useParams` read sits inside the
 * page's Suspense boundary (dynamic route params are only known at request
 * time under cacheComponents).
 */

import { useParams } from "next/navigation";
import CampaignBuilder from "@/components/campaign-builder";

export default function EditCampaignBuilder() {
  const params = useParams<{ id: string }>();
  return <CampaignBuilder mode="edit" campaignId={params.id} />;
}
