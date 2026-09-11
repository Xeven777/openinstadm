"use client";

/**
 * Campaigns List — interactive island
 *
 * Receives the server-rendered campaign list and accounts as props (no client
 * data fetching for the list itself). Owns all the interactivity: account /
 * search / status filtering, sorting, list/grid views, optimistic toggle +
 * delete overlays, duplicate, copy URL, the kebab menu, and the IG media
 * (thumbnail + reel lightbox) layer.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import {
  ArrowRight,
  ArrowSquareOut,
  CaretRight,
  ChatCircle,
  Check,
  Clock,
  Copy,
  DotsThreeVertical,
  EnvelopeSimple,
  FunnelSimple,
  Hash,
  LinkSimple,
  ListBullets,
  LockSimple,
  MagnifyingGlass,
  Megaphone,
  Pause,
  Play,
  Plus,
  Pulse,
  PushPin,
  SquaresFour,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query/keys";
import { fetchPosts } from "@/lib/query/api";
import type { CampaignListItem as Campaign } from "@/lib/server/automations";
import { canManageAutomations, useWorkspaceContext } from "@/lib/workspace-context";

interface CampaignsListProps {
  campaigns: Campaign[];
  accounts: AccountOption[];
}

type StatusFilter = "all" | "active" | "paused";
type SortKey = "recent" | "name" | "sent" | "ctr";
type ViewMode = "list" | "grid";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "name", label: "Name A–Z" },
  { value: "sent", label: "Most DMs sent" },
  { value: "ctr", label: "Highest CTR" },
];

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

function linkDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function CampaignsList({
  campaigns,
  accounts,
}: CampaignsListProps) {
  const router = useRouter();
  const canManage = canManageAutomations(useWorkspaceContext());
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  // Optimistic mutation state, applied as an overlay on top of server data so
  // an in-flight navigation can never revert a toggle/delete.
  const [overrides, setOverrides] = useState<Record<string, Campaign>>({});
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
  // The reel currently playing in the lightbox (null when closed).
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    postUrl: string | null;
    name: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("list");

  // Server data is authoritative for the selected account scope; mutations are
  // applied as an overlay on top instead of a separate fetch.
  const automations = useMemo(() => {
    const scope =
      selectedAccountId === "all"
        ? campaigns
        : campaigns.filter((c) => c.instagramAccountId === selectedAccountId);
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
    () =>
      Array.from(new Set(automations.map((a) => a.instagramAccountId))).sort(),
    [automations],
  );
  const mediaQuery = useQuery({
    queryKey: queryKeys.media(mediaAccountIds),
    queryFn: async () => {
      const lists = await Promise.all(
        mediaAccountIds.map((accountId) =>
          fetchPosts(accountId, { limit: 50 })
            .then((p) => p.data)
            .catch(
              () =>
                [] as {
                  id: string;
                  media_type?: string;
                  media_url?: string;
                  thumbnail_url?: string;
                }[],
            ),
        ),
      );
      const thumbs: Record<string, string> = {};
      const vids: Record<string, string> = {};
      for (const list of lists) {
        for (const media of list) {
          const url = media.thumbnail_url ?? media.media_url;
          if (url) thumbs[media.id] = url;
          if (media.media_type === "VIDEO" && media.media_url)
            vids[media.id] = media.media_url;
        }
      }
      return { thumbs, videos: vids };
    },
    enabled: mediaAccountIds.length > 0,
    staleTime: 15 * 60 * 1000,
  });
  const thumbnails = mediaQuery.data?.thumbs ?? {};
  const videos = mediaQuery.data?.videos ?? {};

  // Close overlays on Escape.
  useEffect(() => {
    if (!playingVideo && !confirmDeleteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlayingVideo(null);
        setConfirmDeleteId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playingVideo, confirmDeleteId]);

  // Lock body scroll while an overlay is open.
  useEffect(() => {
    if (!playingVideo && !confirmDeleteId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [playingVideo, confirmDeleteId]);

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
      gooeyToast.success(isActive ? `${name} paused` : `${name} activated`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/automations?id=${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed to delete");
      }),
    onMutate: (id) => {
      setRemovedIds((prev) => new Set(prev).add(id));
      setConfirmDeleteId(null);
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
        1500,
      );
    } catch (err) {
      console.error("Failed to copy reel URL:", err);
      gooeyToast.error("Could not copy reel URL");
    }
  }

  function requestDelete(id: string) {
    setMenuOpenId(null);
    setConfirmDeleteId(id);
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
  const counts = useMemo(
    () => ({
      all: automations.length,
      active: automations.filter((a) => a.isActive).length,
      paused: automations.filter((a) => !a.isActive).length,
    }),
    [automations],
  );

  const filtered = useMemo(() => {
    const list = automations.filter((a) => {
      if (statusFilter === "active" && !a.isActive) return false;
      if (statusFilter === "paused" && a.isActive) return false;
      if (!query) return true;
      return (
        a.name.toLowerCase().includes(query) ||
        a.keywords.some((k) => k.toLowerCase().includes(query)) ||
        a.dmMessage.toLowerCase().includes(query) ||
        a.instagramAccount.username.toLowerCase().includes(query)
      );
    });
    const sorted = [...list];
    switch (sortKey) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "sent":
        sorted.sort((a, b) => b.analytics.sent - a.analytics.sent);
        break;
      case "ctr":
        sorted.sort((a, b) => b.analytics.ctr - a.analytics.ctr);
        break;
      case "recent":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        break;
    }
    return sorted;
  }, [automations, statusFilter, query, sortKey]);

  const hasActiveFilters =
    query.length > 0 || statusFilter !== "all" || selectedAccountId !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSelectedAccountId("all");
  }

  const activeCount = counts.active;
  const sentCount = automations.reduce(
    (total, campaign) => total + campaign.analytics.sent,
    0,
  );
  const clickCount = automations.reduce(
    (total, campaign) => total + campaign.analytics.clicks,
    0,
  );

  const kpis = [
    {
      icon: <Pulse weight="fill" className="size-4" />,
      value: activeCount.toLocaleString(),
      label: "Live now",
      sub: `${counts.paused} paused`,
      tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: <ChatCircle weight="fill" className="size-4" />,
      value: sentCount.toLocaleString(),
      label: "DMs delivered",
      sub: "across all campaigns",
      tint: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    },
    {
      icon: <LinkSimple weight="bold" className="size-4" />,
      value: clickCount.toLocaleString(),
      label: "Tracked clicks",
      sub:
        sentCount > 0
          ? `${((clickCount / Math.max(sentCount, 1)) * 100).toFixed(1)}% avg CTR`
          : "no sends yet",
      tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    },
  ];

  const statusTabs: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "active", label: "Active", count: counts.active },
    { value: "paused", label: "Paused", count: counts.paused },
  ];

  const confirmDeleteCampaign = confirmDeleteId
    ? (automations.find((a) => a.id === confirmDeleteId) ?? null)
    : null;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-5 px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-9">
                Campaigns
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Turn any comment into a DM conversation — keywords in, links
                out.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <Link
                  href="/campaigns/import"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  <UploadSimple weight="bold" className="size-4" />
                  Import
                </Link>
              )}
              {canManage && (
                <Link
                  href="/campaigns/new"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "shadow-sm",
                  )}
                >
                  <Plus weight="bold" className="size-4" />
                  New campaign
                </Link>
              )}
            </div>
          </div>

          {automations.length > 0 && (
            <dl className="grid gap-2.5 sm:grid-cols-3">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3"
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      kpi.tint,
                    )}
                  >
                    {kpi.icon}
                  </span>
                  <div className="min-w-0">
                    <dt className="order-2 text-xs text-muted-foreground">
                      {kpi.label} ·{" "}
                      <span className="tabular-nums">{kpi.sub}</span>
                    </dt>
                    <dd className="order-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                      {kpi.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* ── Toolbar ────────────────────────────────────────── */}
      {automations.length > 0 && (
        <section
          aria-label="Filter and sort campaigns"
          className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-3.5"
        >
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <MagnifyingGlass
                weight="bold"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
                placeholder="Search name, keyword, message, or @account…"
                aria-label="Search campaigns"
                className="border-transparent bg-muted/60 pl-9 pr-9 shadow-none focus-visible:border-ring focus-visible:bg-background"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X weight="bold" className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="campaign-sort">
                Sort campaigns
              </label>
              <div className="relative">
                <FunnelSimple
                  weight="bold"
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <select
                  id="campaign-sort"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="h-9 appearance-none rounded-lg border border-border bg-background pl-8 pr-8 text-sm font-medium text-foreground shadow-xs outline-none transition-colors hover:bg-muted/60 focus-visible:border-ring"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <CaretRight
                  weight="bold"
                  className="pointer-events-none absolute right-2.5 top-1/2 size-3 rotate-90 text-muted-foreground"
                />
              </div>

              <div
                role="group"
                aria-label="Change layout"
                className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5"
              >
                {(
                  [
                    {
                      value: "list",
                      icon: <ListBullets weight="bold" className="size-4" />,
                      label: "List view",
                    },
                    {
                      value: "grid",
                      icon: <SquaresFour weight="bold" className="size-4" />,
                      label: "Grid view",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setView(opt.value)}
                    aria-pressed={view === opt.value}
                    title={opt.label}
                    aria-label={opt.label}
                    className={cn(
                      "grid size-8 place-items-center rounded-md transition-all",
                      view === opt.value
                        ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-border/70 pt-3">
            <div
              role="group"
              aria-label="Filter by status"
              className="flex items-center gap-1.5"
            >
              {statusTabs.map((tab) => {
                const isActive = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    aria-pressed={isActive}
                    className={cn(
                      "inline-flex h-7.5 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-all",
                      isActive
                        ? "bg-foreground text-background shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab.value === "active" && (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isActive ? "bg-emerald-400" : "bg-emerald-500",
                        )}
                      />
                    )}
                    {tab.value === "paused" && (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isActive ? "bg-zinc-400" : "bg-zinc-400",
                        )}
                      />
                    )}
                    {tab.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        isActive ? "bg-background/20" : "bg-foreground/8",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {accounts.length > 1 && (
                <div className="[&>div]:gap-0 [&_span:first-child]:sr-only">
                  <AccountSelect
                    accounts={accounts}
                    value={selectedAccountId}
                    onChange={handleAccountChange}
                    label="Filter by account"
                  />
                </div>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X weight="bold" className="size-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Empty states ───────────────────────────────────── */}
      {automations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center sm:py-16">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ChatCircle weight="fill" className="size-6" />
          </span>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">
            No campaigns yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
            Pick a post or reel, choose the comments that trigger it, and let
            the DM flow do the follow-up automatically.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href="/campaigns/new" />} className="gap-1.5">
              <Plus weight="bold" className="size-4" />
              Create campaign
            </Button>
            {canManage && (
              <Link
                href="/campaigns/import"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Import existing
              </Link>
            )}
          </div>
          <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-xs text-muted-foreground">
            {["Pick a reel", "Set keywords", "Send the DM"].map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                {i > 0 && (
                  <CaretRight weight="bold" className="size-3 opacity-50" />
                )}
                <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
                  {i + 1}. {step}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {automations.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <MagnifyingGlass weight="bold" className="size-5" />
          </span>
          <h3 className="mt-3 font-semibold">No matches</h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Nothing matches {query ? `“${search.trim()}”` : "these filters"}.
            Try a different keyword or clear the filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="mt-4"
          >
            <X weight="bold" className="size-4" />
            Clear filters
          </Button>
        </div>
      )}

      {/* ── Result meta ────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {filtered.length}
            </span>
            {filtered.length !== automations.length && (
              <span className="tabular-nums"> of {automations.length}</span>
            )}{" "}
            campaign{filtered.length === 1 ? "" : "s"}
            {selectedAccountId !== "all" && (
              <>
                {" "}
                for{" "}
                <span className="font-medium text-foreground">
                  @{accounts.find((a) => a.id === selectedAccountId)?.username}
                </span>
              </>
            )}
          </p>
          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            Click a row to open insights
            <ArrowRight weight="bold" className="size-3.5" />
          </p>
        </div>
      )}

      {/* ── Campaign rows ──────────────────────────────────── */}
      {view === "list" ? (
        <div className="space-y-3">
          {filtered.map((auto) => (
            <CampaignRow
              key={auto.id}
              auto={auto}
              thumb={auto.postId ? thumbnails[auto.postId] : undefined}
              videoUrl={auto.postId ? videos[auto.postId] : undefined}
              canManage={canManage}
              copied={copiedId === auto.id}
              menuOpen={menuOpenId === auto.id}
              onMenuOpenChange={(open) => setMenuOpenId(open ? auto.id : null)}
              onOpen={() => router.push(`/campaigns/${auto.id}`)}
              onPlay={(url) =>
                setPlayingVideo({ url, postUrl: auto.postUrl, name: auto.name })
              }
              onToggle={() => handleToggle(auto.id, auto.isActive)}
              onCopy={() => void copyReelUrl(auto)}
              onDuplicate={() => void duplicateAutomation(auto)}
              onDelete={() => requestDelete(auto.id)}
              toggling={toggleMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((auto) => (
            <CampaignGridCard
              key={auto.id}
              auto={auto}
              thumb={auto.postId ? thumbnails[auto.postId] : undefined}
              videoUrl={auto.postId ? videos[auto.postId] : undefined}
              canManage={canManage}
              copied={copiedId === auto.id}
              menuOpen={menuOpenId === auto.id}
              onMenuOpenChange={(open) => setMenuOpenId(open ? auto.id : null)}
              onOpen={() => router.push(`/campaigns/${auto.id}`)}
              onPlay={(url) =>
                setPlayingVideo({ url, postUrl: auto.postUrl, name: auto.name })
              }
              onToggle={() => handleToggle(auto.id, auto.isActive)}
              onCopy={() => void copyReelUrl(auto)}
              onDuplicate={() => void duplicateAutomation(auto)}
              onDelete={() => requestDelete(auto.id)}
            />
          ))}
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────────── */}
      {confirmDeleteCampaign && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-campaign-title"
          aria-describedby="delete-campaign-desc"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Trash weight="bold" className="size-5" />
            </span>
            <h2
              id="delete-campaign-title"
              className="mt-3 font-semibold tracking-tight"
            >
              Delete “{confirmDeleteCampaign.name}”?
            </h2>
            <p
              id="delete-campaign-desc"
              className="mt-1 text-sm leading-6 text-muted-foreground"
            >
              {confirmDeleteCampaign.analytics.sent.toLocaleString()} DMs were
              sent through this campaign. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDeleteId(null)}
              >
                Keep
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDeleteCampaign.id)}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reel lightbox ──────────────────────────────────── */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setPlayingVideo(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Reel preview — ${playingVideo.name}`}
        >
          <div
            className="flex w-full max-w-md flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-zinc-200">
                {playingVideo.name}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {playingVideo.postUrl && (
                  <a
                    href={playingVideo.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <ArrowSquareOut weight="bold" className="size-4" />
                    Instagram
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPlayingVideo(null)}
                  aria-label="Close preview"
                  className="grid size-8 place-items-center rounded-lg bg-white/10 text-zinc-200 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X weight="bold" className="size-4" />
                </button>
              </div>
            </div>
            <video
              src={playingVideo.url}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[76vh] w-full rounded-2xl border border-white/10 bg-black object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ shared bits ═══════════════════════ */

interface CardActions {
  canManage: boolean;
  copied: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  toggling?: boolean;
}

function StatusPill({
  active,
  size = "md",
}: {
  active: boolean;
  size?: "md" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
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

function FlowSteps({ auto }: { auto: Campaign }) {
  const steps: { icon: React.ReactNode; label: string }[] = [];
  steps.push({
    icon: <ChatCircle weight="fill" className="size-3.5" />,
    label: auto.matchAnyWord
      ? "Any comment"
      : auto.keywords.length > 0
        ? auto.keywords.slice(0, 2).join(" · ") +
          (auto.keywords.length > 2 ? ` +${auto.keywords.length - 2}` : "")
        : "No keyword",
  });
  if (auto.publicReplyEnabled)
    steps.push({
      icon: <Megaphone weight="bold" className="size-3.5" />,
      label: "Reply",
    });
  if (auto.openingDmEnabled)
    steps.push({
      icon: <EnvelopeSimple weight="bold" className="size-3.5" />,
      label: "Opener",
    });
  steps.push({
    icon: <PushPin weight="bold" className="size-3.5" />,
    label: "DM",
  });
  if (auto.trackedLinks.length > 0)
    steps.push({
      icon: <LinkSimple weight="bold" className="size-3.5" />,
      label:
        auto.trackedLinks.length > 1
          ? `${auto.trackedLinks.length} links`
          : "Link",
    });
  if (auto.requireFollow)
    steps.push({
      icon: <LockSimple weight="bold" className="size-3.5" />,
      label: "Follow gate",
    });
  if (auto.followUpEnabled)
    steps.push({
      icon: <Clock weight="bold" className="size-3.5" />,
      label: "Follow-up",
    });

  return (
    <div className="flex flex-wrap items-center gap-y-1.5">
      {steps.map((step, i) => (
        <span key={`${step.label}-${i}`} className="flex items-center">
          {i > 0 && (
            <CaretRight
              weight="bold"
              className="mx-1 size-3 shrink-0 text-muted-foreground/50"
            />
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {step.icon}
            {step.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

function ActionsCluster({
  auto,
  canManage,
  copied,
  menuOpen,
  onMenuOpenChange,
  onToggle,
  onCopy,
  onDuplicate,
  onDelete,
  toggling,
  compact,
}: CardActions & { auto: Campaign; compact?: boolean }) {
  return (
    <div
      className={cn("flex items-center", compact ? "gap-1" : "gap-1.5")}
      onClick={(e) => e.stopPropagation()}
    >
      {auto.postUrl && (
        <button
          type="button"
          onClick={onCopy}
          title={copied ? "Copied!" : "Copy reel URL"}
          aria-label={copied ? "Copied!" : "Copy reel URL"}
          className={cn(
            "grid size-8 place-items-center rounded-lg border transition-all",
            copied
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
          )}
        >
          {copied ? (
            <Check weight="bold" className="size-4" />
          ) : (
            <LinkSimple weight="bold" className="size-4" />
          )}
        </button>
      )}
      {canManage && (
        <span
          className="flex items-center gap-2 rounded-lg px-1"
          title={auto.isActive ? "Pause campaign" : "Activate campaign"}
        >
          <Switch
            checked={auto.isActive}
            onCheckedChange={onToggle}
            disabled={toggling}
            size="sm"
            aria-label={auto.isActive ? "Pause campaign" : "Activate campaign"}
          />
        </span>
      )}
      {canManage && (
        <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="More actions"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
              >
                <DotsThreeVertical weight="bold" className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy weight="bold" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash weight="bold" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function MediaThumb({
  auto,
  thumb,
  videoUrl,
  size,
  onPlay,
  onOpen,
}: {
  auto: Campaign;
  thumb: string | undefined;
  videoUrl: string | undefined;
  size: "row" | "grid";
  onPlay: (url: string) => void;
  onOpen: () => void;
}) {
  if (thumb) {
    return (
      <div
        className={cn(
          "group/thumb relative shrink-0 overflow-hidden bg-muted",
          size === "row"
            ? "size-20 rounded-xl sm:size-24"
            : "aspect-square w-full",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="size-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
        />
        {videoUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(videoUrl);
            }}
            aria-label={`Play reel preview for ${auto.name}`}
            className="absolute inset-0 grid place-items-center bg-black/25 opacity-100 transition-opacity hover:bg-black/40"
          >
            <span className="grid size-9 place-items-center rounded-full bg-white/95 text-black shadow-lg transition-transform hover:scale-105">
              <Play weight="fill" className="ml-0.5 size-4" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            aria-label={`Open ${auto.name}`}
            className="absolute inset-0 bg-transparent"
            tabIndex={-1}
          />
        )}
        <span
          className={cn(
            "absolute left-2 top-2 size-2 rounded-full ring-2 ring-white/90",
            auto.isActive ? "bg-emerald-500" : "bg-zinc-400",
          )}
        />
      </div>
    );
  }

  const fallbackLabel = auto.matchAnyPost
    ? "Any post"
    : auto.pendingNextReel
      ? "Next reel"
      : "No preview";
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden bg-linear-to-br from-muted via-muted/70 to-muted",
        size === "row"
          ? "size-20 rounded-xl sm:size-24"
          : "aspect-square w-full",
      )}
    >
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        {auto.pendingNextReel ? (
          <Clock weight="bold" className="size-5" />
        ) : (
          <Hash weight="bold" className="size-5" />
        )}
        <span className="px-2 text-center text-[10px] font-medium leading-tight">
          {fallbackLabel}
        </span>
      </div>
      <span
        className={cn(
          "absolute left-2 top-2 size-2 rounded-full ring-2 ring-white/90",
          auto.isActive ? "bg-emerald-500" : "bg-zinc-400",
        )}
      />
    </div>
  );
}

/* ═══════════════════════ list row ═══════════════════════ */

function CampaignRow({
  auto,
  thumb,
  videoUrl,
  onOpen,
  onPlay,
  ...actions
}: {
  auto: Campaign;
  thumb: string | undefined;
  videoUrl: string | undefined;
  onOpen: () => void;
  onPlay: (url: string) => void;
} & CardActions) {
  const domain = linkDomain(auto.trackedLinks[0]?.trackedUrl);
  const ctr = Math.min(Math.max(auto.analytics.ctr, 0), 100);

  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      tabIndex={0}
      role="link"
      aria-label={`${auto.name} — ${auto.isActive ? "active" : "paused"}`}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-200 hover:-translate-y-px hover:border-foreground/15 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        <MediaThumb
          auto={auto}
          thumb={thumb}
          videoUrl={videoUrl}
          size="row"
          onPlay={onPlay}
          onOpen={onOpen}
        />

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                  {auto.name}
                </h3>
                <ArrowRight
                  weight="bold"
                  className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                />
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium">
                  @{auto.instagramAccount.username}
                </span>
                <span aria-hidden="true" className="text-border">
                  •
                </span>
                <span>Edited {timeAgo(auto.updatedAt)}</span>
                {domain && (
                  <>
                    <span aria-hidden="true" className="text-border">
                      •
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <LinkSimple weight="bold" className="size-3" />
                      {domain}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden sm:block">
                <StatusPill active={auto.isActive} size="sm" />
              </span>
              <ActionsCluster auto={auto} {...actions} compact />
            </div>
          </div>

          <div className="mt-2.5 sm:hidden">
            <StatusPill active={auto.isActive} size="sm" />
          </div>

          {/* Flow */}
          <div className="mt-2.5">
            <FlowSteps auto={auto} />
          </div>

          {/* DM preview */}
          <p className="mt-2 truncate border-l-2 border-border pl-2.5 text-[13px] italic leading-5 text-muted-foreground">
            &ldquo;{auto.dmMessage}&rdquo;
          </p>

          {/* Metrics footer */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
            <Metric value={auto._count.dmLogs.toLocaleString()} label="runs" />
            <Metric value={auto.analytics.sent.toLocaleString()} label="sent" />
            <Metric
              value={auto.analytics.clicks.toLocaleString()}
              label="clicks"
            />
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {auto.analytics.ctr}%
              </span>
              <span className="text-[11px] text-muted-foreground">CTR</span>
              <span
                className="h-1 w-14 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${auto.analytics.ctr}% click-through rate`}
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    ctr >= 10
                      ? "bg-emerald-500"
                      : ctr > 0
                        ? "bg-sky-500"
                        : "bg-muted-foreground/30",
                  )}
                  style={{ width: `${Math.min(ctr, 100)}%` }}
                />
              </span>
            </span>
            {auto.pendingNextReel && (
              <Badge variant="warning" className="gap-1">
                <Clock weight="bold" className="size-3" />
                Waiting for next reel
              </Badge>
            )}
            {auto.analytics.topKeywords.length > 0 && (
              <span className="ml-auto hidden items-center gap-1.5 md:flex">
                {auto.analytics.topKeywords.slice(0, 2).map((k) => (
                  <span
                    key={k.keyword}
                    className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                  >
                    #{k.keyword} · {k.count}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════ grid card ═══════════════════════ */

function CampaignGridCard({
  auto,
  thumb,
  videoUrl,
  onOpen,
  onPlay,
  ...actions
}: {
  auto: Campaign;
  thumb: string | undefined;
  videoUrl: string | undefined;
  onOpen: () => void;
  onPlay: (url: string) => void;
} & CardActions) {
  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      tabIndex={0}
      role="link"
      aria-label={`${auto.name} — ${auto.isActive ? "active" : "paused"}`}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-200 hover:-translate-y-1 hover:border-foreground/15 hover:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.3)] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative">
        <MediaThumb
          auto={auto}
          thumb={thumb}
          videoUrl={videoUrl}
          size="grid"
          onPlay={onPlay}
          onOpen={onOpen}
        />
        <div
          className="absolute right-2.5 top-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1 rounded-lg bg-black/55 p-1 text-white backdrop-blur-sm">
            <ActionsCluster auto={auto} {...actions} compact />
          </span>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex items-center gap-2">
          <StatusPill active={auto.isActive} size="sm" />
          <span className="truncate text-xs text-muted-foreground">
            @{auto.instagramAccount.username}
          </span>
          {auto.isActive ? null : (
            <Pause
              weight="fill"
              className="ml-auto size-3.5 shrink-0 text-muted-foreground"
            />
          )}
        </div>
        <h3 className="truncate text-[15px] font-semibold tracking-tight">
          {auto.name}
        </h3>
        <FlowSteps auto={auto} />
        <p className="truncate text-[13px] italic text-muted-foreground">
          &ldquo;{auto.dmMessage}&rdquo;
        </p>
        <div className="flex items-center gap-3 border-t border-border/60 pt-3">
          <Metric value={auto.analytics.sent.toLocaleString()} label="sent" />
          <Metric
            value={auto.analytics.clicks.toLocaleString()}
            label="clicks"
          />
          <Metric value={`${auto.analytics.ctr}%`} label="CTR" />
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open <ArrowRight weight="bold" className="size-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
