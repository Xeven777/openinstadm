"use client";

/**
 * Campaign Detail — interactive island
 *
 * Receives the single server-rendered campaign as a prop (no client data
 * fetching for the campaign itself — the RSC page queries it directly). Owns
 * the interactive bits: the optimistic Stop/Resume toggle, copy-link buttons,
 * the preview phone tab, and the live avatar/post thumbnail fetches
 * (Instagram URLs expire, so they are never stored on the campaign).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretRight,
  ChartBar,
  ChatCircle,
  Check,
  Checks,
  Clock,
  Copy,
  CursorClick,
  EnvelopeSimple,
  Eye,
  Hash,
  Image as ImageIcon,
  LinkSimple,
  LockSimple,
  Megaphone,
  PaperPlaneTilt,
  Pause,
  PencilSimple,
  Play,
  PushPin,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import CampaignPreview, {
  type PreviewTab,
} from "@/components/campaign-preview";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query/keys";
import { fetchProfile, fetchPosts } from "@/lib/query/api";
import type { CampaignListItem } from "@/lib/server/automations";
import { canManageAutomations, useWorkspaceContext } from "@/lib/workspace-context";

interface CampaignDetailProps {
  campaign: CampaignListItem;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CampaignDetail({ campaign }: CampaignDetailProps) {
  const router = useRouter();
  const canManage = canManageAutomations(useWorkspaceContext());
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  const [copied, setCopied] = useState<string | null>(null);
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
  const postMedia = campaign.postId
    ? (postsQuery.data?.data.find((p) => p.id === campaign.postId) ?? null)
    : null;
  const postThumb = campaign.postId
    ? (postMedia?.thumbnail_url ?? postMedia?.media_url ?? null)
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
      gooeyToast.success(isActive ? "Campaign paused" : "Campaign activated");
      // Re-render the server component so the fresh toggle state streams back
      // from the page instead of a client fetch.
      router.refresh();
    },
    onError: () => {
      gooeyToast.error("Could not update campaign");
    },
  });

  async function toggleActive() {
    try {
      await toggleMutation.mutateAsync();
    } catch {
      // keep current state
    }
  }

  async function copyText(text: string, key: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      gooeyToast.success(`${label} copied`);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      gooeyToast.error(`Could not copy ${label.toLowerCase()}`);
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

  const triggerLabel = campaign.matchAnyPost
    ? "Any post or reel"
    : campaign.pendingNextReel
      ? "Your next reel"
      : "A specific post or reel";

  const a = campaign.analytics;
  const runs = campaign._count.dmLogs;
  const sentRate = runs > 0 ? Math.round((a.sent / runs) * 100) : 0;

  const kpis = useMemo(
    () => [
      {
        icon: <PaperPlaneTilt weight="fill" className="size-4" />,
        label: "DMs sent",
        value: a.sent.toLocaleString(),
        hint: `${sentRate}% of ${runs.toLocaleString()} runs`,
        tint: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
        bar: sentRate,
        barTint: "bg-sky-500",
      },
      {
        icon: <CursorClick weight="bold" className="size-4" />,
        label: "Link clicks",
        value: a.clicks.toLocaleString(),
        hint: `${a.ctr}% click-through`,
        tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
        bar: Math.min(a.ctr, 100),
        barTint: "bg-violet-500",
      },
      {
        icon: <Checks weight="bold" className="size-4" />,
        label: "Runs",
        value: runs.toLocaleString(),
        hint: `${a.skipped.toLocaleString()} skipped`,
        tint: "bg-muted text-foreground",
        bar: 100,
        barTint: "bg-foreground/25",
      },
      {
        icon: <WarningCircle weight="bold" className="size-4" />,
        label: "Failed",
        value: a.failed.toLocaleString(),
        hint:
          runs > 0
            ? `${((a.failed / runs) * 100).toFixed(1)}% of runs`
            : "no failures",
        tint:
          a.failed > 0
            ? "bg-destructive/10 text-destructive"
            : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
        bar: runs > 0 ? Math.min((a.failed / runs) * 100, 100) : 0,
        barTint: a.failed > 0 ? "bg-destructive" : "bg-emerald-500",
      },
    ],
    [a, runs, sentRate],
  );

  // Numbered flow steps — only enabled steps get a number; disabled ones
  // render as a dimmed "off" row so the timeline reads as the real path.
  let stepNumber = 0;
  const step = () => {
    // eslint-disable-next-line react-hooks/immutability
    stepNumber += 1;
    return stepNumber;
  };

  return (
    <div className="space-y-5">
      {/* ── Hero header ─────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-linear-to-l from-card dark:to-lime-600/20 to-lime-300/20">
        <div className="px-5 pb-5 pt-4 sm:px-7">
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

          <div className="mt-3 flex flex-wrap items-start gap-4">
            {postThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postThumb}
                alt=""
                className="size-16 shrink-0 rounded-2xl border border-border object-cover sm:size-20"
              />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground sm:size-20">
                <ImageIcon weight="bold" className="size-6" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                  {campaign.name}
                </h1>
                <StatusPill active={isActive} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">
                  @{campaign.instagramAccount.username}
                </span>
                <span aria-hidden="true">•</span>
                <span>{triggerLabel}</span>
                <span aria-hidden="true">•</span>
                <span>Edited {timeAgo(campaign.updatedAt)}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {campaign.matchAnyWord ? (
                  <Badge variant="secondary">Any comment triggers</Badge>
                ) : (
                  campaign.keywords.slice(0, 4).map((kw) => (
                    <Badge
                      key={kw}
                      className="rounded-md border-primary/15 bg-primary/10 text-primary"
                    >
                      {kw}
                    </Badge>
                  ))
                )}
                {!campaign.matchAnyWord && campaign.keywords.length > 4 && (
                  <Badge variant="secondary">
                    +{campaign.keywords.length - 4} more
                  </Badge>
                )}
                {campaign.requireFollow && (
                  <Badge variant="secondary" className="gap-1">
                    <LockSimple weight="bold" className="size-3" />
                    Follow gate
                  </Badge>
                )}
                {campaign.pendingNextReel && (
                  <Badge variant="warning" className="gap-1">
                    <Clock weight="bold" className="size-3" />
                    Waiting for next reel
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {campaign.postUrl && (
                <a
                  href={campaign.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  <ArrowSquareOut weight="bold" className="size-4" />
                  <span className="hidden sm:inline">View post</span>
                </a>
              )}
              {canManage && (
                <Link
                  href={`/campaigns/${campaign.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  <PencilSimple weight="bold" className="size-4" />
                  Edit
                </Link>
              )}
              {canManage && (
                <Button
                  onClick={() => void toggleActive()}
                  disabled={toggleMutation.isPending}
                  size="sm"
                  variant={isActive ? "destructive" : "default"}
                  className={cn(
                    !isActive && "bg-emerald-600 hover:bg-emerald-600/85",
                  )}
                >
                  {isActive ? (
                    <>
                      <Pause weight="fill" className="size-4" />
                      {toggleMutation.isPending ? "Pausing…" : "Pause"}
                    </>
                  ) : (
                    <>
                      <Play weight="fill" className="size-4" />
                      {toggleMutation.isPending ? "Resuming…" : "Resume"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          {!canManage && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Eye weight="bold" className="size-4" />
              You have view-only access to this campaign.
            </p>
          )}
        </div>
      </section>

      {/* ── KPI strip ───────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-border bg-card px-4 py-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <dt className="truncate text-xs text-muted-foreground">
                {kpi.label}
              </dt>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg",
                  kpi.tint,
                )}
              >
                {kpi.icon}
              </span>
            </div>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {kpi.value}
            </dd>
            <dd className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
              {kpi.hint}
            </dd>
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${kpi.label}: ${kpi.hint}`}
            >
              <div
                className={cn("h-full rounded-full", kpi.barTint)}
                style={{ width: `${kpi.bar}%` }}
              />
            </div>
          </div>
        ))}
      </dl>

      {/* ── Funnel ──────────────────────────────────────── */}
      <Card size="sm">
        <CardContent className="gap-3">
          <div className="flex items-center gap-2">
            <ChartBar weight="bold" className="size-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold">Conversion funnel</p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <FunnelBlock label="Runs" value={runs} pct={100} active />
            <FunnelArrow />
            <FunnelBlock
              label="Sent"
              value={a.sent}
              pct={sentRate}
              active={a.sent > 0}
            />
            <FunnelArrow />
            <FunnelBlock
              label="Clicked"
              value={a.clicks}
              pct={a.ctr}
              active={a.clicks > 0}
            />
          </div>
          {runs === 0 && (
            <p className="text-xs leading-5 text-muted-foreground">
              No runs yet — once someone comments with a trigger keyword, sends
              and clicks will appear here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Main: flow + side rail ──────────────────────── */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Flow timeline */}
        <section
          aria-label="Automation flow"
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <h2 className="text-[15px] font-semibold tracking-tight">
              How it works
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              The exact path from comment to DM, in order.
            </p>
          </div>

          <ol className="space-y-0 px-5 py-2 sm:px-6">
            {/* 1 — Trigger post */}
            <FlowStep
              n={step()}
              icon={<ImageIcon weight="bold" className="size-4" />}
              title="Trigger post"
              desc="Which Instagram post this campaign listens to"
            >
              <div className="flex items-center gap-3">
                {postThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={postThumb}
                    alt="Trigger post"
                    className="size-14 shrink-0 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-muted text-[10px] font-medium text-muted-foreground">
                    {campaign.matchAnyPost || campaign.pendingNextReel
                      ? "Any"
                      : "Post"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{triggerLabel}</p>
                  {campaign.postUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          campaign.postUrl!,
                          `post-${campaign.id}`,
                          "Post URL",
                        )
                      }
                      className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                      title="Copy post URL"
                    >
                      {copied === `post-${campaign.id}` ? (
                        <Check
                          weight="bold"
                          className="size-3.5 shrink-0 text-emerald-500"
                        />
                      ) : (
                        <Copy weight="bold" className="size-3.5 shrink-0" />
                      )}
                      <span className="truncate">{campaign.postUrl}</span>
                    </button>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      No specific post linked — listens everywhere.
                    </p>
                  )}
                </div>
              </div>
            </FlowStep>

            {/* 2 — Keyword match */}
            <FlowStep
              n={step()}
              icon={<ChatCircle weight="fill" className="size-4" />}
              title="Comment match"
              desc="What the comment has to contain"
            >
              <div className="flex flex-wrap gap-1.5">
                {campaign.matchAnyWord ? (
                  <Badge variant="secondary">Any comment matches</Badge>
                ) : campaign.keywords.length > 0 ? (
                  campaign.keywords.map((kw) => (
                    <Badge
                      key={kw}
                      className="rounded-md border-primary/15 bg-primary/10 font-mono text-primary"
                    >
                      {kw}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">No keyword set</Badge>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {!campaign.matchAnyWord && campaign.wholeWordMatch && (
                  <li>
                    • Whole-word matching is on — “link” won’t match “blink”.
                  </li>
                )}
                {campaign.dmTriggerEnabled && (
                  <li>
                    • Also fires when someone DMs{" "}
                    {campaign.matchAnyWord ? "anything" : "these words"}{" "}
                    directly.
                  </li>
                )}
              </ul>
            </FlowStep>

            {/* 3 — Public reply */}
            {campaign.publicReplyEnabled ? (
              <FlowStep
                n={step()}
                icon={<Megaphone weight="bold" className="size-4" />}
                title="Public reply"
                desc="Posted under their comment for social proof"
              >
                <div className="space-y-1.5">
                  {publicReplies.map((m, i) => (
                    <QuoteBox key={i}>{m}</QuoteBox>
                  ))}
                </div>
              </FlowStep>
            ) : (
              <FlowOff
                label="Public reply"
                hint="No comment left under the post"
              />
            )}

            {/* 4 — Opening DM */}
            {campaign.openingDmEnabled ? (
              <FlowStep
                n={step()}
                icon={<EnvelopeSimple weight="bold" className="size-4" />}
                title="Opening DM"
                desc="Sent first to warm up the conversation"
              >
                <QuoteBox>
                  {campaign.openingDmMessage || "Opening message"}
                </QuoteBox>
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-[13px] font-medium">
                  {campaign.openingDmButtonLabel || "Button"}
                </p>
              </FlowStep>
            ) : (
              <FlowOff
                label="Opening DM"
                hint="Skipped — goes straight to the main DM"
              />
            )}

            {/* 5 — Follow gate */}
            {campaign.requireFollow ? (
              <FlowStep
                n={step()}
                icon={<LockSimple weight="bold" className="size-4" />}
                title="Follow gate"
                desc="They must follow before the link is revealed"
              >
                <QuoteBox>
                  {campaign.followPromptMessage || "Follow prompt message"}
                </QuoteBox>
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-[13px] font-medium">
                  {campaign.followPromptButtonLabel || "I'm following"}
                </p>
              </FlowStep>
            ) : (
              <FlowOff label="Follow gate" hint="Off — no follow required" />
            )}

            {/* 6 — Main DM + links */}
            <FlowStep
              n={step()}
              icon={<PushPin weight="bold" className="size-4" />}
              title="Main DM + link"
              desc="The message that delivers the goods"
            >
              <QuoteBox>{campaign.dmMessage}</QuoteBox>
              {hasLink && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-[13px] font-medium">
                    <LinkSimple weight="bold" className="size-3.5" />
                    {campaign.linkButtonLabel || "Open link"}
                  </span>
                  {hasSecondLink && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-[13px] font-medium">
                      <LinkSimple weight="bold" className="size-3.5" />
                      {campaign.trackedLinks?.[1]?.label || "Open link"}
                    </span>
                  )}
                </div>
              )}
              {campaign.trackedLinks?.filter((l) => l.destinationUrl).length >
                0 && (
                <div className="mt-2.5 space-y-2">
                  {campaign.trackedLinks
                    .filter((l) => l.destinationUrl)
                    .map((link) => (
                      <div
                        key={link.id}
                        className="rounded-xl border border-border bg-muted/40 p-2.5"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(
                              link.trackedUrl ?? link.destinationUrl,
                              link.id,
                              "Tracked link",
                            )
                          }
                          className="flex w-full items-center gap-2 text-left"
                          title="Copy tracked link"
                        >
                          <code className="min-w-0 flex-1 select-all truncate font-mono text-xs text-foreground">
                            {link.trackedUrl ?? link.destinationUrl}
                          </code>
                          {copied === link.id ? (
                            <Check
                              weight="bold"
                              className="size-4 shrink-0 text-emerald-500"
                            />
                          ) : (
                            <Copy
                              weight="bold"
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                          )}
                        </button>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {link.label && (
                            <span className="font-medium">{link.label}</span>
                          )}
                          <span className="break-all">
                            → {link.destinationUrl}
                          </span>
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1 tabular-nums">
                            <CursorClick weight="bold" className="size-3.5" />
                            {link._count.clicks.toLocaleString()} clicks
                          </span>
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </FlowStep>

            {/* 7 — Follow-up */}
            {campaign.followUpEnabled && campaign.followUpMessage ? (
              <FlowStep
                n={step()}
                last
                icon={<Clock weight="bold" className="size-4" />}
                title="Follow-up nudge"
                desc={
                  campaign.followUpDelayMinutes &&
                  campaign.followUpDelayMinutes > 0
                    ? `Sent ${campaign.followUpDelayMinutes} min after the link`
                    : "Sent right after the link"
                }
              >
                <QuoteBox>{campaign.followUpMessage}</QuoteBox>
              </FlowStep>
            ) : (
              <FlowOff
                last
                label="Follow-up"
                hint="Off — conversation ends after the link"
              />
            )}
          </ol>
        </section>

        {/* Side rail */}
        <aside className="space-y-5 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border/70 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <Eye weight="bold" className="size-4 text-muted-foreground" />
                Live preview
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Exactly what a follower sees on Instagram.
              </p>
            </div>
            <div className="bg-linear-to-b from-muted/60 to-transparent px-4 pb-5 pt-4">
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
                  campaign.followPromptButtonLabel ?? "I'm following"
                }
                followUpEnabled={campaign.followUpEnabled ?? false}
                followUpMessage={campaign.followUpMessage ?? ""}
                followUpDelayMinutes={campaign.followUpDelayMinutes ?? 0}
              />
            </div>
          </section>

          {campaign.analytics.topKeywords.length > 0 && (
            <Card size="sm">
              <CardContent className="gap-2.5">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                  <Hash
                    weight="bold"
                    className="size-4 text-muted-foreground"
                  />
                  Top keywords
                </h2>
                <div className="space-y-1.5">
                  {campaign.analytics.topKeywords.map((k) => {
                    const max = campaign.analytics.topKeywords[0]?.count ?? 1;
                    return (
                      <div
                        key={k.keyword}
                        className="flex items-center gap-2 text-[13px]"
                      >
                        <span className="w-24 truncate font-mono">
                          #{k.keyword}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max((k.count / max) * 100, 6)}%`,
                            }}
                          />
                        </span>
                        <span className="w-8 text-right tabular-nums text-muted-foreground">
                          {k.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardContent className="gap-2.5">
              <h2 className="text-[13px] font-semibold">Details</h2>
              <dl className="space-y-1.5 text-[13px]">
                <DetailRow
                  label="Account"
                  value={`@${campaign.instagramAccount.username}`}
                  mono={false}
                />
                <DetailRow
                  label="Created"
                  value={fullDate(campaign.createdAt)}
                />
                <DetailRow
                  label="Last edited"
                  value={`${fullDate(campaign.updatedAt)} (${timeAgo(campaign.updatedAt)})`}
                />
                <DetailRow
                  label="Match mode"
                  value={
                    campaign.matchAnyWord
                      ? "Any comment"
                      : campaign.wholeWordMatch
                        ? "Whole words"
                        : "Contains"
                  }
                />
                {campaign.reportUrl && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Report</dt>
                    <dd>
                      <a
                        href={campaign.reportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Open share link
                        <ArrowSquareOut weight="bold" className="size-3.5" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {campaign.analytics.skipped > 0 && (
                <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                  <XCircle weight="bold" className="mt-0.5 size-3.5 shrink-0" />
                  {campaign.analytics.skipped.toLocaleString()} runs were
                  skipped (duplicate, gated, or filtered).
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────── */

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span className="relative flex size-1.5">
        {active && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            active ? "bg-emerald-500" : "bg-zinc-400",
          )}
        />
      </span>
      {active ? "Active" : "Paused"}
    </span>
  );
}

function FunnelBlock({
  label,
  value,
  pct,
  active,
}: {
  label: string;
  value: number;
  pct: number;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-28 flex-1 rounded-xl border px-3 py-2.5",
        active
          ? "border-border bg-background"
          : "border-dashed border-border bg-muted/40",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums tracking-tight",
          !active && "text-muted-foreground",
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] tabular-nums text-muted-foreground">{pct}%</p>
    </div>
  );
}

function FunnelArrow() {
  return (
    <span className="grid place-items-center self-center text-muted-foreground/60">
      <CaretRight weight="bold" className="size-4" />
    </span>
  );
}

function FlowStep({
  n,
  icon,
  title,
  desc,
  children,
  last,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-6 pt-4 last:pb-4">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-4.25 top-12 w-px bg-border"
        />
      )}
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-[13px] font-semibold tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  );
}

function FlowOff({
  label,
  hint,
  last,
}: {
  label: string;
  hint: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-6 pt-4 opacity-55 last:pb-4">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-4.25 top-12 w-px bg-border"
        />
      )}
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-border bg-muted/50 text-muted-foreground">
        <XCircle weight="bold" className="size-4" />
      </span>
      <div className="min-w-0 flex-1 self-center">
        <p className="text-sm font-medium">
          {label}{" "}
          <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
            off
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </li>
  );
}

function QuoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm leading-6">
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate text-right font-medium",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
