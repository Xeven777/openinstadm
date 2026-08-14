"use client";

/**
 * Overview Posts View — interactive island
 *
 * Renders the per-post list as either a visual thumbnail grid or a dense
 * table, with a segmented toggle in the card header. The RSC passes the
 * snapshot-backed posts down as plain serializable props, so switching views
 * is pure client state — no refetch, no server round-trip.
 *
 * Grid thumbnails are lazy-loaded (`loading="lazy"`) so a large "all time"
 * range doesn't stall first paint on dozens of Instagram CDN images.
 */

import { useState } from "react";
import {
  BookmarkSimple,
  ChatCircle,
  Eye,
  GridFour,
  Heart,
  ImageSquare,
  ListDashes,
  ShareNetwork,
  Users,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OverviewPost } from "@/lib/server/overview";

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  REELS: "Reel",
  VIDEO: "Video",
  IMAGE: "Photo",
  CAROUSEL_ALBUM: "Carousel",
  CAROUSEL: "Carousel",
};

function mediaTypeLabel(mediaType: string): string {
  return MEDIA_TYPE_LABELS[mediaType] ?? mediaType;
}

type ViewMode = "table" | "grid";

export default function OverviewPostsView({ posts }: { posts: OverviewPost[] }) {
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageSquare weight="fill" className="size-4 text-primary" />
          Posts
        </CardTitle>
        <CardAction className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {posts.length} post{posts.length === 1 ? "" : "s"}
          </span>
          <Tabs value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
            <TabsList aria-label="Posts view">
              <TabsTrigger value="table" title="Table view">
                <ListDashes weight="bold" className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="grid" title="Grid view">
                <GridFour weight="bold" className="size-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No posts found
          </p>
        ) : view === "table" ? (
          <PostsTable posts={posts} />
        ) : (
          <PostsGrid posts={posts} />
        )}
      </CardContent>
    </Card>
  );
}

function PostsTable({ posts }: { posts: OverviewPost[] }) {
  return (
    // Eight metric columns can't compress into a phone; let the table keep its
    // natural width and scroll inside the panel instead.
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-190 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Post</th>
            <th className="py-2 px-3 font-medium text-right">Views</th>
            <th className="py-2 px-3 font-medium text-right">Reach</th>
            <th className="py-2 px-3 font-medium text-right">Likes</th>
            <th className="py-2 px-3 font-medium text-right">Comments</th>
            <th className="py-2 px-3 font-medium text-right">Saved</th>
            <th className="py-2 px-3 font-medium text-right">Shares</th>
            <th className="py-2 pl-3 font-medium text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="max-w-xs py-3 pr-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-foreground/5">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageSquare weight="fill" className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    {p.permalink ? (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-foreground transition-colors hover:text-primary"
                      >
                        {p.caption || "Untitled post"}
                      </a>
                    ) : (
                      <span className="block truncate text-foreground">
                        {p.caption || "Untitled post"}
                      </span>
                    )}
                    <Badge variant="muted" className="mt-1">
                      {mediaTypeLabel(p.mediaType)}
                    </Badge>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(p.views)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(p.reach)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(p.likes)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(p.comments)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(p.saved)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                {formatNumber(p.shares)}
              </td>
              <td className="py-3 pl-3 text-right whitespace-nowrap text-muted-foreground">
                {formatDate(p.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostsGrid({ posts }: { posts: OverviewPost[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

function PostCard({ post: p }: { post: OverviewPost }) {
  const body = (
    <>
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        {p.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.thumbnailUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageSquare weight="fill" className="size-6" />
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 shadow-xs backdrop-blur-md"
        >
          {mediaTypeLabel(p.mediaType)}
        </Badge>
        <span className="absolute right-2 bottom-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-medium shadow-xs backdrop-blur-md tabular-nums text-foreground">
          {formatDate(p.timestamp)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {p.caption || "Untitled post"}
        </p>
        {/* Same metric set as the table view, in the same order */}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Views">
            <Eye className="size-3.5" />
            {formatNumber(p.views)}
          </span>
          <span className="inline-flex items-center gap-1" title="Reach">
            <Users className="size-3.5" />
            {formatNumber(p.reach)}
          </span>
          <span className="inline-flex items-center gap-1" title="Likes">
            <Heart className="size-3.5" />
            {formatNumber(p.likes)}
          </span>
          <span className="inline-flex items-center gap-1" title="Comments">
            <ChatCircle className="size-3.5" />
            {formatNumber(p.comments)}
          </span>
          <span className="inline-flex items-center gap-1" title="Saved">
            <BookmarkSimple className="size-3.5" />
            {formatNumber(p.saved)}
          </span>
          <span className="inline-flex items-center gap-1" title="Shares">
            <ShareNetwork className="size-3.5" />
            {formatNumber(p.shares)}
          </span>
        </div>
      </div>
    </>
  );

  const wrapper =
    "group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs ring-1 ring-foreground/10 transition-colors hover:border-foreground/25";

  return p.permalink ? (
    <a
      href={p.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={wrapper}
    >
      {body}
    </a>
  ) : (
    <div className={wrapper}>{body}</div>
  );
}
