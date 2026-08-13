"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * Post Picker
 *
 * Grid of Instagram post thumbnails, selectable.
 * Fetches from /api/instagram/posts.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass } from "@phosphor-icons/react";
import RefreshIcon from "@/components/refresh-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeAgo } from "@/lib/utils/time";
import { queryKeys } from "@/lib/query/keys";
import { fetchPosts } from "@/lib/query/api";

interface PostPickerProps {
  selectedPostId: string | null;
  instagramAccountId?: string | null;
  /** postId -> name of the campaign already using it. Flagged in the grid. */
  usedPostIds?: Record<string, string>;
  onSelect: (
    postId: string,
    postUrl?: string,
    thumbUrl?: string,
    caption?: string
  ) => void;
}

export default function PostPicker({
  selectedPostId,
  instagramAccountId,
  usedPostIds,
  onSelect,
}: PostPickerProps) {
  const [query, setQuery] = useState("");
  // The post currently hovered — its video (if it's a reel) plays a preview.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load the full library so older posts/reels are selectable, not just the
  // most recent page. The query cache is persisted to IndexedDB, so a revisit
  // restores the library instantly (no skeleton) and revalidates in the
  // background. Switching accounts swaps the query key, so the grid never
  // flashes the previous account's posts.
  const postsKey = queryKeys.posts(instagramAccountId, { all: true });
  const queryClient = useQueryClient();
  const postsQuery = useQuery({
    queryKey: postsKey,
    queryFn: () => fetchPosts(instagramAccountId, { all: true }),
    staleTime: 15 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetchPosts(instagramAccountId, { all: true, refresh: true }),
    onSuccess: (payload) => {
      queryClient.setQueryData(postsKey, payload);
    },
  });

  // Derive the view straight from the query — posts + freshness stay in
  // lockstep with no parallel state to keep in sync. `isPending` is true only
  // when there is nothing cached yet (an IndexedDB restore skips it), so a
  // revisit paints the last library instantly.
  const posts = postsQuery.data?.data ?? [];
  const lastFetchedAt = postsQuery.data?.snapshot?.fetchedAt ?? null;
  const loading = postsQuery.isPending;
  const error = postsQuery.error
    ? postsQuery.error instanceof Error
      ? postsQuery.error.message
      : "Failed to load posts"
    : null;

  // Manual refresh: bypass the Postgres snapshot (refresh=true) so a newly
  // published post shows up immediately. The grid keeps showing the current
  // library while the refetch is in flight.
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshMutation.mutateAsync();
    } catch {
      // Best-effort — keep the current grid on failure.
    } finally {
      // Transient UI flag — always safe to clear.
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="text-xs text-zinc-500 mt-1">
          Connect your Instagram account first
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No posts found</p>
      </div>
    );
  }

  const visible = query.trim()
    ? posts.filter((p) =>
        (p.caption ?? "").toLowerCase().includes(query.trim().toLowerCase())
      )
    : posts;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass
            weight="bold"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your posts by caption…"
            className="pl-9"
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {posts.length}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          title="Refresh from Instagram"
          aria-label="Refresh from Instagram"
          className="shrink-0"
        >
          <RefreshIcon className={refreshing ? "animate-spin" : ""} />
        </Button>
      </div>
      {lastFetchedAt && (
        <p className="px-1 text-[11px] text-muted-foreground">
          Last refreshed {formatTimeAgo(lastFetchedAt)}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No posts match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <>
          {usedPostIds && Object.keys(usedPostIds).length > 0 && (
            <Badge
              variant="outline"
              className="gap-1.5 font-normal text-muted-foreground"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-warning/50" />
              Already used
            </Badge>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
            {visible.map((post) => {
              const isSelected = selectedPostId === post.id;
              const usedByName = usedPostIds?.[post.id];
              const isUsed = Boolean(usedByName) && !isSelected;
              const thumb = post.thumbnail_url ?? post.media_url;
              const isVideo = post.media_type === "VIDEO";
              const showVideo =
                isVideo && hoveredId === post.id && Boolean(post.media_url);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() =>
                    onSelect(post.id, post.permalink, thumb, post.caption)
                  }
                  onMouseEnter={() => setHoveredId(post.id)}
                  onMouseLeave={() =>
                    setHoveredId((cur) => (cur === post.id ? null : cur))
                  }
                  aria-pressed={isSelected}
                  title={isUsed ? `Already used by "${usedByName}"` : undefined}
                  className={`
              relative aspect-square rounded overflow-hidden border-2
              ${
                isSelected
                  ? "border-primary"
                  : isUsed
                    ? "border-warning/40 hover:border-warning/60"
                    : "border-border hover:border-foreground/20"
              }
            `}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={post.caption?.slice(0, 50) ?? "Instagram post"}
                      className={`w-full h-full object-cover ${isUsed ? "opacity-75" : ""}`}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        No image
                      </span>
                    </div>
                  )}
                  {showVideo && (
                    <video
                      src={post.media_url}
                      poster={thumb}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="none"
                      className={`absolute inset-0 h-full w-full object-cover ${
                        isUsed ? "opacity-60" : ""
                      }`}
                    />
                  )}
                  {isSelected && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary py-1 text-center text-xs font-medium text-primary-foreground">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
