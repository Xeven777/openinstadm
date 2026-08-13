"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * Post Picker
 *
 * Grid of Instagram post thumbnails, selectable.
 * Fetches from /api/instagram/posts.
 */

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import RefreshIcon from "@/components/refresh-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { readCache, writeCache } from "@/lib/client-cache";
import { formatTimeAgo } from "@/lib/utils/time";

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

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
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The post currently hovered — its video (if it's a reel) plays a preview.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // When the server-side post snapshot was written (snapshot.fetchedAt).
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Bumped whenever the account changes; manual refreshes started for a
  // previous account are dropped once their token no longer matches.
  const refreshTokenRef = useRef(0);

  useEffect(() => {
    // Invalidate any in-flight manual refresh for the previous account.
    refreshTokenRef.current += 1;
    let cancelled = false;
    const params = new URLSearchParams();
    if (instagramAccountId) {
      params.set("instagramAccountId", instagramAccountId);
    }
    // Load the full library so older posts/reels are selectable, not just the
    // most recent page.
    params.set("all", "true");

    // Show the cached library instantly (stale-while-revalidate), then refresh.
    const cacheKey = `ig-posts:${instagramAccountId ?? "default"}`;
    const cached = readCache<InstagramPost[]>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cached.data) {
      setPosts(cached.data);
      setLoading(false);
    }
    // The previous account's freshness no longer applies; hide it until the
    // new account's fetch reports its snapshot time.
    setLastFetchedAt(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(`/api/instagram/posts${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setPosts(data.data);
          writeCache(cacheKey, data.data);
          if (data.snapshot?.fetchedAt) {
            setLastFetchedAt(data.snapshot.fetchedAt as string);
          }
        } else if (!cached.data) {
          setError(data.error ?? "Failed to load posts");
        }
      })
      .catch(() => {
        if (!cancelled && !cached.data) setError("Failed to load posts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instagramAccountId]);

  // Manual refresh: bypass the Postgres snapshot (refresh=true) so a newly
  // published post shows up immediately. The grid keeps showing the current
  // library while the refetch is in flight. If the account changes mid-flight,
  // the response is dropped so it can't clobber the new account's grid.
  async function handleRefresh() {
    setRefreshing(true);
    const token = refreshTokenRef.current;
    try {
      const params = new URLSearchParams();
      if (instagramAccountId) {
        params.set("instagramAccountId", instagramAccountId);
      }
      params.set("all", "true");
      params.set("refresh", "true");

      const res = await fetch(`/api/instagram/posts?${params}`);
      const data = await res.json();
      if (data.success && token === refreshTokenRef.current) {
        setPosts(data.data);
        writeCache(`ig-posts:${instagramAccountId ?? "default"}`, data.data);
        if (data.snapshot?.fetchedAt) {
          setLastFetchedAt(data.snapshot.fetchedAt as string);
        }
      }
    } catch {
      // Best-effort — keep the current grid on failure.
    } finally {
      // Transient UI flag — always safe to clear, even for a stale request.
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
                    : "border-border hover:border-border-hover"
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
