"use client";

/**
 * Campaigns List — interactive island
 *
 * Receives the server-rendered campaign list and accounts as props (no client
 * data fetching for the list itself). Owns all the interactivity: account /
 * search / status filtering, optimistic toggle + delete overlays, duplicate,
 * copy URL, the kebab menu, and the IG media (thumbnail + reel lightbox) layer.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import {
  ArrowSquareOut,
  ChatCircle,
  Copy,
  DotsThreeVertical,
  LinkSimple,
  MagnifyingGlass,
  Plus,
  Pulse,
  Trash,
  X,
} from "@phosphor-icons/react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query/keys";
import { fetchPosts } from "@/lib/query/api";
import type { CampaignListItem as Campaign } from "@/lib/server/automations";

interface CampaignsListProps {
  campaigns: Campaign[];
  accounts: AccountOption[];
}

export default function CampaignsList({ campaigns, accounts }: CampaignsListProps) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  // Optimistic mutation state, applied as an overlay on top of server data so
  // an in-flight navigation can never revert a toggle/delete.
  const [overrides, setOverrides] = useState<Record<string, Campaign>>({});
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
  // The reel currently playing in the lightbox (null when closed).
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    postUrl: string | null;
  } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">(
    "all"
  );

  // Server data is authoritative for the selected account scope; mutations are
  // applied as an overlay on top instead of a separate fetch.
  const automations = useMemo(() => {
    const scope =
      selectedAccountId === "all"
        ? campaigns
        : campaigns.filter(
            (c) => c.instagramAccountId === selectedAccountId
          );
    const next: Campaign[] = [];
    for (const campaign of scope) {
      if (removedIds.has(campaign.id)) continue;
      next.push(overrides[campaign.id] ?? campaign);
    }
    return next;
  }, [campaigns, selectedAccountId, overrides, removedIds]);

  // Live post thumbnails + reel video URLs, keyed by the accounts in view.
  // TanStack Query + IndexedDB means they restore instantly on revisit; the
  // underlying IG URLs are always fresh (fetched server-side, short-lived).
  const mediaAccountIds = useMemo(
    () => Array.from(new Set(automations.map((a) => a.instagramAccountId))).sort(),
    [automations]
  );
  const mediaQuery = useQuery({
    queryKey: queryKeys.media(mediaAccountIds),
    queryFn: async () => {
      const lists = await Promise.all(
        mediaAccountIds.map((accountId) =>
          fetchPosts(accountId, { limit: 50 })
            .then((p) => p.data)
            .catch(() => [] as { id: string; media_type?: string; media_url?: string; thumbnail_url?: string }[])
        )
      );
      const thumbs: Record<string, string> = {};
      const vids: Record<string, string> = {};
      for (const list of lists) {
        for (const media of list) {
          const url = media.thumbnail_url ?? media.media_url;
          if (url) thumbs[media.id] = url;
          if (media.media_type === "VIDEO" && media.media_url) vids[media.id] = media.media_url;
        }
      }
      return { thumbs, videos: vids };
    },
    enabled: mediaAccountIds.length > 0,
    staleTime: 15 * 60 * 1000,
  });
  const thumbnails = mediaQuery.data?.thumbs ?? {};
  const videos = mediaQuery.data?.videos ?? {};

  // Close the reel lightbox on Escape.
  useEffect(() => {
    if (!playingVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayingVideo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playingVideo]);

  function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId);
    setMenuOpenId(null);
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/automations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to toggle");
      }),
    onMutate: ({ id, isActive }) => {
      // Optimistically flip the UI immediately; the overlay is reverted only
      // on error.
      const current = automations.find((a) => a.id === id);
      if (current) {
        setOverrides((prev) => ({
          ...prev,
          [id]: { ...current, isActive: !isActive },
        }));
      }
    },
    onError: (_err, { id }) => {
      // Server rejected the toggle — drop the overlay so the badge reverts.
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      gooeyToast.error("Could not update campaign");
    },
    onSuccess: (_data, { id, isActive }) => {
      const campaign = automations.find((a) => a.id === id);
      const name = campaign?.name ?? "Campaign";
      gooeyToast.success(
        isActive ? `${name} paused` : `${name} activated`
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/automations?id=${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed to delete");
      }),
    onMutate: (id) => {
      setRemovedIds((prev) => new Set(prev).add(id));
    },
    onError: (_err, id) => {
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      gooeyToast.error("Could not delete campaign");
    },
    onSuccess: (_data, id) => {
      const campaign = automations.find((a) => a.id === id);
      gooeyToast.success(`${campaign?.name ?? "Campaign"} deleted`);
    },
  });

  async function copyReelUrl(auto: Campaign) {
    setMenuOpenId(null);
    if (!auto.postUrl) return;
    try {
      await navigator.clipboard.writeText(auto.postUrl);
      setCopiedId(auto.id);
      gooeyToast.success("Reel URL copied");
      window.setTimeout(
        () => setCopiedId((cur) => (cur === auto.id ? null : cur)),
        1500
      );
    } catch (err) {
      console.error("Failed to copy reel URL:", err);
      gooeyToast.error("Could not copy reel URL");
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    deleteMutation.mutate(id);
  }

  function handleToggle(id: string, isActive: boolean) {
    toggleMutation.mutate({ id, isActive });
  }

  async function duplicateAutomation(auto: Campaign) {
    setMenuOpenId(null);
    const specific = !auto.matchAnyPost && !auto.pendingNextReel;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${auto.name} copy`,
          instagramAccountId: auto.instagramAccountId,
          postId: specific ? auto.postId : null,
          postUrl: specific ? auto.postUrl : null,
          matchAnyPost: auto.matchAnyPost,
          pendingNextReel: auto.pendingNextReel,
          matchAnyWord: auto.matchAnyWord,
          keywords: auto.keywords,
          dmMessage: auto.dmMessage,
          openingDmEnabled: auto.openingDmEnabled,
          openingDmMessage: auto.openingDmMessage,
          openingDmButtonLabel: auto.openingDmButtonLabel,
          publicReplyEnabled: auto.publicReplyEnabled,
          publicReplyMessages: auto.publicReplyMessages,
          trackedDestinationUrl: auto.trackedLinks[0]?.destinationUrl ?? "",
          secondaryDestinationUrl: auto.trackedLinks[1]?.destinationUrl ?? "",
          secondaryButtonLabel: auto.trackedLinks[1]?.label ?? "Open link",
          requireFollow: auto.requireFollow,
          followPromptMessage: auto.followPromptMessage,
          followPromptButtonLabel: auto.followPromptButtonLabel,
          wholeWordMatch: auto.wholeWordMatch,
          isActive: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        gooeyToast.success(`${auto.name} duplicated`);
        router.refresh();
      } else {
        console.error("Duplicate failed:", data.error);
        gooeyToast.error(data.error ?? "Could not duplicate campaign");
      }
    } catch (err) {
      console.error("Failed to duplicate:", err);
      gooeyToast.error("Could not duplicate campaign");
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = automations.filter((a) => {
    if (statusFilter === "active" && !a.isActive) return false;
    if (statusFilter === "paused" && a.isActive) return false;
    if (!query) return true;
    return (
      a.name.toLowerCase().includes(query) ||
      a.keywords.some((k) => k.toLowerCase().includes(query)) ||
      a.dmMessage.toLowerCase().includes(query)
    );
  });
  const activeCount = automations.filter((campaign) => campaign.isActive).length;
  const sentCount = automations.reduce(
    (total, campaign) => total + campaign.analytics.sent,
    0,
  );
  const clickCount = automations.reduce(
    (total, campaign) => total + campaign.analytics.clicks,
    0,
  );

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Automation studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Campaigns
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Create the exact path from an Instagram comment to a useful DM.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={handleAccountChange}
            />
          )}
          <Link
            href="/campaigns/import"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex-1 sm:flex-none",
            )}
          >
            Import
          </Link>
          <Link
            href="/campaigns/new"
            className={cn(
              buttonVariants({ variant: "default" }),
              "flex-1 shadow-sm sm:flex-none",
            )}
          >
            <Plus weight="bold" />
            New Campaign
          </Link>
          </div>
        </div>
        {automations.length > 0 && (
          <div className="grid border-t border-border sm:grid-cols-3">
            <div className="flex items-center gap-3 px-5 py-4 sm:px-7">
              <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                <Pulse weight="fill" className="size-4" />
              </span>
              <div>
                <p className="text-lg font-semibold tabular-nums">{activeCount}</p>
                <p className="text-xs text-muted-foreground">live campaigns</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-4 sm:border-l sm:border-t-0 sm:px-7">
              <span className="grid size-9 place-items-center rounded-full bg-muted text-foreground">
                <ChatCircle weight="fill" className="size-4" />
              </span>
              <div>
                <p className="text-lg font-semibold tabular-nums">{sentCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">DMs delivered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-4 sm:border-l sm:border-t-0 sm:px-7">
              <span className="grid size-9 place-items-center rounded-full bg-muted text-foreground">
                <LinkSimple weight="bold" className="size-4" />
              </span>
              <div>
                <p className="text-lg font-semibold tabular-nums">{clickCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">tracked clicks</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Search + status filter */}
      {automations.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlass
              weight="bold"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, keyword, or message"
              className="border-0 bg-muted/55 pl-9 shadow-none"
            />
          </div>
          <Tabs
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as "all" | "active" | "paused")
            }
            className="shrink-0"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Empty state */}
      {automations.length === 0 && (
        <div className="bg-muted rounded p-8 text-center sm:p-12">
          <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Create your first comment-to-DM campaign to turn a post or reel into
            a measurable conversation flow.
          </p>
          <Button render={<Link href="/campaigns/new" />} className="gap-2">
            <Plus weight="bold" />
            Create Campaign
          </Button>
        </div>
      )}

      {/* No matches for the current filter */}
      {automations.length > 0 && filtered.length === 0 && (
        <div className="bg-muted rounded p-8 text-center text-sm text-muted-foreground">
          No campaigns match your search.
        </div>
      )}

      {automations.length > 0 && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-foreground">
            {filtered.length}
            {filtered.length !== automations.length
              ? ` of ${automations.length}`
              : ""}{" "}
            campaign{filtered.length === 1 ? "" : "s"}
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Select a campaign to inspect the full automation.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((auto) => {
          const videoUrl = auto.postId ? videos[auto.postId] : undefined;
          return (
            <Card
              key={auto.id}
              size="sm"
              onClick={() => router.push(`/campaigns/${auto.id}`)}
              className="cursor-pointer border-border/80 transition-[box-shadow,transform,ring-color] hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20"
            >
              <CardContent className="gap-4">
                {/* Wraps rather than compressing: on a phone the action buttons drop
                to their own line instead of squeezing the campaign summary. */}
                <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
                  {auto.postId &&
                    thumbnails[auto.postId] &&
                    (videoUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlayingVideo({
                            url: videoUrl,
                            postUrl: auto.postUrl,
                          });
                        }}
                        aria-label="Play reel preview"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnails[auto.postId]}
                          alt="Campaign reel"
                          className="h-20 w-20 rounded-xl border border-border object-cover transition-transform hover:scale-[1.03]"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </button>
                    ) : (
                      <a
                        href={auto.postUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnails[auto.postId]}
                          alt="Campaign post"
                          className="h-20 w-20 rounded-xl border border-border object-cover transition-transform hover:scale-[1.03]"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </a>
                    ))}
                  <div className="min-w-52 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="mr-auto text-base font-semibold tracking-tight">
                        {auto.name}
                      </h3>
                      <Badge variant="outline">
                        @{auto.instagramAccount.username}
                      </Badge>
                      <Badge variant={auto.isActive ? "success" : "muted"}>
                        {auto.isActive ? "Active" : "Paused"}
                      </Badge>
                      {auto.pendingNextReel && (
                        <Badge variant="warning">Waiting for next reel</Badge>
                      )}
                      {auto.requireFollow && (
                        <Badge variant="secondary">Follow gate</Badge>
                      )}
                      {auto.trackedLinks.length >= 2 && (
                        <Badge variant="secondary">2 links</Badge>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                      <div className="rounded-lg bg-muted/55 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {auto.matchAnyWord ? (
                            <Badge variant="secondary">Any comment</Badge>
                          ) : auto.keywords.length > 0 ? (
                            auto.keywords.map((kw) => (
                              <Badge
                                key={kw}
                                className="rounded-md border-primary/10 bg-primary/10 text-primary"
                              >
                                {kw}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary">No keyword set</Badge>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/55 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery flow</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {auto.publicReplyEnabled && <Badge variant="secondary">Public reply</Badge>}
                          {auto.openingDmEnabled && <Badge variant="secondary">Opening DM</Badge>}
                          {auto.requireFollow && <Badge variant="secondary">Follow gate</Badge>}
                          {auto.trackedLinks.length > 0 && <Badge variant="secondary">Link delivery</Badge>}
                          {auto.followUpEnabled && <Badge variant="secondary">Follow-up</Badge>}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground truncate">
                      &ldquo;{auto.dmMessage}&rdquo;
                    </p>

                    {/* Tracked link sent */}
                    {auto.trackedLinks[0]?.trackedUrl && (
                      <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
                        {auto.trackedLinks[0].trackedUrl}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="mt-4 grid grid-cols-4 divide-x divide-border rounded-lg border border-border bg-card text-center">
                      <div className="px-2 py-2.5"><p className="text-sm font-semibold tabular-nums">{auto._count.dmLogs}</p><p className="text-[11px] text-muted-foreground">runs</p></div>
                      <div className="px-2 py-2.5"><p className="text-sm font-semibold tabular-nums">{auto.analytics.sent}</p><p className="text-[11px] text-muted-foreground">sent</p></div>
                      <div className="px-2 py-2.5"><p className="text-sm font-semibold tabular-nums">{auto.analytics.clicks}</p><p className="text-[11px] text-muted-foreground">clicks</p></div>
                      <div className="px-2 py-2.5"><p className="text-sm font-semibold tabular-nums">{auto.analytics.ctr}%</p><p className="text-[11px] text-muted-foreground">CTR</p></div>
                    </div>

                    {auto.analytics.topKeywords.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {auto.analytics.topKeywords.map((keyword) => (
                          <Badge
                            key={keyword.keyword}
                            variant="outline"
                            className="rounded-md text-muted-foreground"
                          >
                            {keyword.keyword}: {keyword.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="ml-auto flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Copy reel URL */}
                    {auto.postUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyReelUrl(auto)}
                        className="shrink-0 rounded-full"
                      >
                        {copiedId === auto.id ? "Copied!" : "Copy URL"}
                      </Button>
                    )}
                    {/* Toggle */}
                    <Switch
                      checked={auto.isActive}
                      onCheckedChange={() =>
                        handleToggle(auto.id, auto.isActive)
                      }
                      aria-label="Toggle campaign"
                    />

                    {/* Kebab menu */}
                    <DropdownMenu
                      open={menuOpenId === auto.id}
                      onOpenChange={(open) =>
                        setMenuOpenId(open ? auto.id : null)
                      }
                    >
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="More actions"
                          >
                            <DotsThreeVertical weight="bold" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => void duplicateAutomation(auto)}
                        >
                          <Copy weight="bold" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setMenuOpenId(null);
                            void handleDelete(auto.id);
                          }}
                        >
                          <Trash weight="bold" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reel lightbox */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="relative flex max-w-full flex-col items-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 text-sm">
              {playingVideo.postUrl && (
                <a
                  href={playingVideo.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white"
                >
                  <ArrowSquareOut weight="bold" className="size-4" />
                  Open on Instagram
                </a>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPlayingVideo(null)}
                className="text-zinc-300 hover:text-white"
              >
                <X weight="bold" />
                Close
              </Button>
            </div>
            <video
              src={playingVideo.url}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[80vh] max-w-full rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
