"use client";

/**
 * Campaign Detail — interactive island
 *
 * Receives the single server-rendered campaign as a prop (no client data
 * fetching for the campaign itself — the RSC page queries it directly). Owns
 * the interactive bits: Insights/Preview tabs, the optimistic Stop/Resume
 * toggle, and the live avatar/post thumbnail fetches (Instagram URLs expire,
 * so they are never stored on the campaign).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "@phosphor-icons/react";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import StatCard from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query/keys";
import { fetchProfile, fetchPosts } from "@/lib/query/api";
import type { CampaignListItem } from "@/lib/server/automations";

type Tab = "insights" | "preview";

interface CampaignDetailProps {
  campaign: CampaignListItem;
}

export default function CampaignDetail({ campaign }: CampaignDetailProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("insights");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  // Optimistic toggle, applied on top of the server prop so the badge flips
  // instantly while the PATCH is in flight; router.refresh() then re-renders
  // the server component with the authoritative value.
  const [toggledActive, setToggledActive] = useState<boolean | null>(null);

  const isActive = toggledActive ?? campaign.isActive;

  // Live avatar + post thumbnail. Instagram URLs expire, so they are never
  // stored on the campaign; both are fetched from the IG media/profile queries
  // (cached by TanStack Query + IndexedDB, so a revisit restores them fast).
  const accountId = campaign.instagramAccountId;
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(accountId),
    queryFn: () => fetchProfile(accountId),
    staleTime: 30 * 60 * 1000,
  });
  const avatarUrl = profileQuery.data?.profilePictureUrl ?? null;

  const postsQuery = useQuery({
    queryKey: queryKeys.posts(accountId, { limit: 50 }),
    queryFn: () => fetchPosts(accountId, { limit: 50 }),
    enabled: Boolean(campaign.postId),
    staleTime: 15 * 60 * 1000,
  });
  const postThumb = campaign.postId
    ? (postsQuery.data?.data.find((p) => p.id === campaign.postId)
        ?.thumbnail_url ??
      postsQuery.data?.data.find((p) => p.id === campaign.postId)?.media_url ??
      null)
    : null;

  const toggleMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/automations?id=${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: async (res) => {
      // Only apply the optimistic overlay when the server confirmed — if the
      // PATCH failed, the badge/button must keep agreeing with the server
      // data instead of diverging until the next full reload.
      if (!res.ok) return;
      setToggledActive(!isActive);
      // Re-render the server component so the fresh toggle state streams back
      // from the page instead of a client fetch.
      router.refresh();
    },
  });

  async function toggleActive() {
    try {
      await toggleMutation.mutateAsync();
    } catch {
      // keep current state
    }
  }

  const publicReplies =
    campaign.publicReplyMessages && campaign.publicReplyMessages.length > 0
      ? campaign.publicReplyMessages
      : campaign.publicReplyMessage
        ? [campaign.publicReplyMessage]
        : [];
  const hasLink = Boolean(campaign.trackedLinks?.[0]?.destinationUrl);
  const hasSecondLink = Boolean(campaign.trackedLinks?.[1]?.destinationUrl);

  const trigger = campaign.matchAnyPost
    ? "Any post or reel"
    : campaign.pendingNextReel
      ? "Your next reel"
      : "A specific post or reel";
  const matchText = campaign.matchAnyWord
    ? "Any comment"
    : campaign.keywords.join(", ") || "No keywords";

  const metrics = [
    { label: "Sends", value: campaign.analytics.sent },
    { label: "Clicks", value: campaign.analytics.clicks },
    { label: "CTR", value: `${campaign.analytics.ctr}%` },
    { label: "Failed", value: campaign.analytics.failed },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* Left: config summary */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 gap-1.5 px-2 text-muted-foreground",
            )}
          >
            <ArrowLeft weight="bold" className="size-4" />
            Campaigns
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold">{campaign.name}</h1>
          <Badge variant={isActive ? "success" : "muted"}>
            {isActive ? "LIVE" : "Paused"}
          </Badge>
        </div>

        <Summary title="When someone comments on">
          <div className="flex items-center gap-3">
            {postThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postThumb}
                alt="Post"
                className="h-14 w-14 rounded object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded bg-muted text-[10px] text-muted-foreground">
                {campaign.matchAnyPost || campaign.pendingNextReel
                  ? "Any"
                  : "Post"}
              </div>
            )}
            <span className="text-sm text-foreground">{trigger}</span>
          </div>
        </Summary>

        <Summary title="And this comment has">
          <FieldBox>{matchText}</FieldBox>
          {campaign.dmTriggerEnabled && (
            <p className="text-xs text-muted-foreground">
              Also replies when someone DMs{" "}
              {campaign.matchAnyWord ? "anything" : "these words"}.
            </p>
          )}
          {publicReplies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Public reply under the post
              </p>
              {publicReplies.map((m, i) => (
                <FieldBox key={i}>{m}</FieldBox>
              ))}
            </div>
          )}
        </Summary>

        {campaign.openingDmEnabled && (
          <Summary title="They will get an opening DM">
            <FieldBox>
              {campaign.openingDmMessage || "Opening message"}
            </FieldBox>
            <FieldBox>{campaign.openingDmButtonLabel || "Button"}</FieldBox>
          </Summary>
        )}

        {campaign.requireFollow && (
          <Summary title="They must follow first">
            <FieldBox>
              {campaign.followPromptMessage ||
                "quick favor before i send your link. i don't make any money from this, it's free. if you want to support me, just don't unfollow after, and star the repo on github if it helps you. tap the button once you're following and i'll send it over"}
            </FieldBox>
            <FieldBox>
              {campaign.followPromptButtonLabel || "i'm following"}
            </FieldBox>
          </Summary>
        )}

        <Summary title="And then, they will get a DM">
          <FieldBox>{campaign.dmMessage}</FieldBox>
          {hasLink && (
            <FieldBox>{campaign.linkButtonLabel || "Open link"}</FieldBox>
          )}
          {hasSecondLink && (
            <FieldBox>
              {campaign.trackedLinks?.[1]?.label || "Open link"}
            </FieldBox>
          )}
        </Summary>

        {hasLink && (
          <Summary title="The exact link sent">
            {campaign.trackedLinks
              ?.filter((link) => link.destinationUrl)
              .map((link, i) => (
                <div key={i} className="space-y-1">
                  <div className="rounded border border-border bg-muted px-3 py-2">
                    <p className="select-all break-all font-mono text-xs text-foreground">
                      {link.trackedUrl ?? link.destinationUrl}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {link.label ? `${link.label} · ` : ""}redirects to{" "}
                    <span className="break-all">{link.destinationUrl}</span>
                  </p>
                </div>
              ))}
          </Summary>
        )}

        {campaign.followUpEnabled && campaign.followUpMessage && (
          <Summary title="Then a follow-up message">
            <FieldBox>{campaign.followUpMessage}</FieldBox>
            <p className="text-xs text-muted-foreground">
              {campaign.followUpDelayMinutes &&
              campaign.followUpDelayMinutes > 0
                ? `Sent ${campaign.followUpDelayMinutes} min after the link.`
                : "Sent right after the link."}
            </p>
          </Summary>
        )}
      </div>

      {/* Right: top bar + tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-border pb-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList variant="line">
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Link
              href={`/campaigns/${campaign.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Edit
            </Link>
            <Button
              onClick={() => void toggleActive()}
              disabled={toggleMutation.isPending}
              variant={isActive ? "destructive" : "outline"}
              className={
                isActive
                  ? ""
                  : "border-success/30 text-success hover:bg-success/10"
              }
            >
              {isActive ? "Stop" : "Resume"}
            </Button>
          </div>
        </div>

        {tab === "insights" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metrics.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        )}

        {tab === "preview" && (
          <div className="flex justify-center sm:justify-start">
            <CampaignPreview
              tab={previewTab}
              onTabChange={setPreviewTab}
              username={campaign.instagramAccount.username}
              avatarUrl={avatarUrl}
              postThumb={postThumb}
              caption=""
              sampleComment={
                campaign.matchAnyWord
                  ? "nice!"
                  : (campaign.keywords[0] ?? "LINK")
              }
              dmTriggerEnabled={campaign.dmTriggerEnabled}
              publicReplyEnabled={campaign.publicReplyEnabled}
              publicReplyMessage={publicReplies[0] ?? ""}
              openingDmEnabled={campaign.openingDmEnabled}
              openingDmMessage={campaign.openingDmMessage ?? ""}
              openingDmButtonLabel={campaign.openingDmButtonLabel ?? ""}
              revealMessage={campaign.dmMessage}
              hasLink={hasLink}
              linkButtonLabel={campaign.linkButtonLabel ?? "Open link"}
              linkUrl={
                campaign.trackedLinks?.[0]?.trackedUrl ??
                campaign.trackedLinks?.[0]?.destinationUrl
              }
              hasSecondLink={hasSecondLink}
              secondLinkButtonLabel={
                campaign.trackedLinks?.[1]?.label ?? "Open link"
              }
              requireFollow={campaign.requireFollow}
              followPromptMessage={campaign.followPromptMessage ?? ""}
              followPromptButtonLabel={
                campaign.followPromptButtonLabel ?? "i'm following"
              }
              followUpEnabled={campaign.followUpEnabled ?? false}
              followUpMessage={campaign.followUpMessage ?? ""}
              followUpDelayMinutes={campaign.followUpDelayMinutes ?? 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-muted px-3 py-2 text-sm text-foreground">
      {children}
    </div>
  );
}


