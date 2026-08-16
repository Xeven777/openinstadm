"use client";

/**
 * Overview Posts View — interactive island
 *
 * Renders the per-post list as either a visual thumbnail grid or a dense
 * table, with a segmented toggle in the card header. The RSC passes the
 * snapshot-backed posts down as plain serializable props, so switching views
 * is pure client state — no refetch, no server round-trip.
 *
 * Both views are virtualized with TanStack Virtual (`@tanstack/react-virtual`)
 * against the dashboard's own scroll surface (the `<main>` element, exposed
 * via `useDashboardScrollElement`) — the window never scrolls on dashboard
 * pages. Only the visible items plus an intentional overscan are mounted:
 * - the table virtualizes fixed-height rows (estimate only),
 * - the grid virtualizes responsive rows (2/3/4 columns) with `measureElement`
 *   so dynamic caption/metric heights are measured, not guessed.
 *
 * Scroll position is snapshotted per post-set (keyed by length + first post
 * id) in memory and sessionStorage, and restored when the dataset or view
 * changes — so an account/range switch or a table↔grid toggle keeps the
 * previous anchor instead of resetting to the top.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDashboardScrollElement } from "@/components/dashboard-scroll";
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

/** Session-scoped key for the last-viewed posts scroll snapshot. */
const SESSION_SNAPSHOT_KEY = "overview:posts:scroll";

/**
 * Signature of a post set. Stable across the two views of the same data, so a
 * snapshot recorded in one view restores in the other. Changes on account /
 * range switch (length or newest post differs).
 */
function postsSignature(posts: OverviewPost[]): string {
  return posts.length > 0 ? `${posts.length}:${posts[0].id}` : "empty";
}

/**
 * Shared virtualization + scroll-snapshot logic for both posts views.
 *
 * The dashboard scrolls inside `<main>` (not the window), and the posts card is
 * not the first child of that scroller — the follower chart and stat tiles sit
 * above it. `scrollMargin` is therefore the offset from the scroller's content
 * origin to the virtual container, recomputed whenever content above resizes
 * (lazy chart, window width). It is invariant to scroll position, so it only
 * needs re-measuring on layout changes, not on every scroll.
 *
 * Visible items are positioned with `translateY(start - scrollMargin)` and the
 * container reserves `getTotalSize()` of space, so only mounted rows exist in
 * the DOM. `measureElement` reports each row's real height to keep the layout
 * exact even when estimates are wrong.
 */
function useOverviewVirtualizer({
  posts,
  count,
  estimateSize,
  overscan,
  getItemKey,
  containerRef,
  scrollSnapshotsRef,
}: {
  posts: OverviewPost[];
  count: number;
  estimateSize: (index: number) => number;
  overscan: number;
  getItemKey?: (index: number) => string | number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollSnapshotsRef: React.RefObject<Map<string, number>>;
}) {
  const scrollElementRef = useDashboardScrollElement();
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const scroller = scrollElementRef?.current;
    const el = containerRef.current;
    if (!scroller || !el) return;
    const update = () => {
      // offset from the scroller's content origin to this container — constant
      // under scroll because both rects move together.
      setScrollMargin(
        el.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop
      );
    };
    update();
    // Re-measure if content above the card resizes (e.g. the lazy-loaded
    // follower chart) or the window does.
    const content = scroller.firstElementChild as HTMLElement | null;
    const observer = new ResizeObserver(update);
    if (content) observer.observe(content);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [scrollElementRef, containerRef]);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollElementRef?.current ?? null,
    estimateSize,
    overscan,
    scrollMargin,
    getItemKey,
  });

  // --- scroll-position snapshot / restore ----------------------------------
  const signature = postsSignature(posts);
  // Always-latest signature so the scroll handler records under the current
  // post set even when a scroll event lands between renders.
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const previousSignatureRef = useRef(signature);

  const scroller = scrollElementRef?.current;

  // Record the offset under the current signature as the user scrolls, both
  // in-memory (survives view toggles) and in sessionStorage (survives leaving
  // and returning to the overview within the tab).
  useEffect(() => {
    if (!scroller) return;
    const onScroll = () => {
      const snapshot = {
        signature: signatureRef.current,
        offset: scroller.scrollTop,
      };
      scrollSnapshotsRef.current.set(snapshot.signature, snapshot.offset);
      try {
        sessionStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        /* private mode / quota — the in-memory snapshot still applies */
      }
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scroller, scrollSnapshotsRef]);

  // Restore on dataset change (account/range switch) or on mount when the new
  // post set has a saved anchor. Unknown post sets reset to the top; the
  // browser naturally clamps if the new list is shorter than the saved offset.
  useEffect(() => {
    const previous = previousSignatureRef.current;
    previousSignatureRef.current = signature;
    const el = scrollElementRef?.current;
    if (!el) return;

    let saved = scrollSnapshotsRef.current.get(signature);
    if (saved === undefined) {
      try {
        const raw = sessionStorage.getItem(SESSION_SNAPSHOT_KEY);
        if (raw) {
          const persisted = JSON.parse(raw) as {
            signature?: string;
            offset?: number;
          };
          if (
            persisted.signature === signature &&
            typeof persisted.offset === "number"
          ) {
            saved = persisted.offset;
          }
        }
      } catch {
        /* ignore malformed or denied storage */
      }
    }

    if (saved !== undefined) {
      const max = Math.max(virtualizer.getTotalSize() - el.clientHeight, 0);
      virtualizer.scrollToOffset(Math.min(saved, max));
    } else if (previous !== signature) {
      el.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return virtualizer;
}

interface VirtualViewProps {
  posts: OverviewPost[];
  scrollSnapshotsRef: React.RefObject<Map<string, number>>;
}

export default function OverviewPostsView({ posts }: { posts: OverviewPost[] }) {
  const [view, setView] = useState<ViewMode>("grid");
  // Scroll-offset snapshots keyed by post-set signature. Shared by both views
  // so a toggle preserves the anchor instead of resetting it.
  const scrollSnapshotsRef = useRef(new Map<string, number>());

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
          <VirtualPostsTable
            posts={posts}
            scrollSnapshotsRef={scrollSnapshotsRef}
          />
        ) : (
          <VirtualPostsGrid
            posts={posts}
            scrollSnapshotsRef={scrollSnapshotsRef}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Table view — virtualized fixed-height rows.
// ---------------------------------------------------------------------------

// Post takes the flexible share; the seven metric/date columns split the rest
// evenly and never drop below 3.5rem. Shared by the header and every row so
// columns line up.
const TABLE_COLS_CLASS = "grid grid-cols-[minmax(0,2.5fr)_repeat(7,minmax(3.5rem,1fr))]";

function VirtualPostsTable({
  posts,
  scrollSnapshotsRef,
}: VirtualViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useOverviewVirtualizer({
    posts,
    count: posts.length,
    estimateSize: () => 64,
    overscan: 12,
    getItemKey: (index) => posts[index]?.id ?? index,
    containerRef,
    scrollSnapshotsRef,
  });

  return (
    // The eight columns can't compress into a phone; the table keeps its
    // natural width (min-w-190) and scrolls horizontally inside the panel.
    <div className="-mx-6 overflow-x-auto px-6">
      <div role="table" aria-label="Posts" className="w-full min-w-190 text-sm">
        {/* Header row */}
        <div
          role="row"
          className={`${TABLE_COLS_CLASS} border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground`}
        >
          <div role="columnheader" className="py-2 pr-4 font-medium">
            Post
          </div>
          <div role="columnheader" className="px-3 py-2 text-right font-medium">
            Views
          </div>
          <div role="columnheader" className="px-3 py-2 text-right font-medium">
            Reach
          </div>
          <div role="columnheader" className="px-3 py-2 text-right font-medium">
            Likes
          </div>
          <div role="columnheader" className="px-3 py-2 text-right font-medium">
            Comments
          </div>
          <div role="columnheader" className="px-3 py-2 text-right font-medium">
            Saved
          </div>
          <div role="columnheader" className="px-3 py-2 text-right font-medium">
            Shares
          </div>
          <div role="columnheader" className="py-2 pl-3 text-right font-medium">
            Date
          </div>
        </div>

        {/* Virtualized body — only visible rows (plus overscan) are mounted. */}
        <div
          ref={containerRef}
          className="relative min-w-190"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const p = posts[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                role="row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                }}
                className={`${TABLE_COLS_CLASS} border-b border-border transition-colors hover:bg-muted/50`}
              >
                <div role="cell" className="max-w-xs py-3 pr-4">
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
                </div>
                <div
                  role="cell"
                  className="px-3 py-3 text-right tabular-nums text-muted-foreground"
                >
                  {formatNumber(p.views)}
                </div>
                <div
                  role="cell"
                  className="px-3 py-3 text-right tabular-nums text-muted-foreground"
                >
                  {formatNumber(p.reach)}
                </div>
                <div
                  role="cell"
                  className="px-3 py-3 text-right tabular-nums text-muted-foreground"
                >
                  {formatNumber(p.likes)}
                </div>
                <div
                  role="cell"
                  className="px-3 py-3 text-right tabular-nums text-muted-foreground"
                >
                  {formatNumber(p.comments)}
                </div>
                <div
                  role="cell"
                  className="px-3 py-3 text-right tabular-nums text-muted-foreground"
                >
                  {formatNumber(p.saved)}
                </div>
                <div
                  role="cell"
                  className="px-3 py-3 text-right tabular-nums text-muted-foreground"
                >
                  {formatNumber(p.shares)}
                </div>
                <div
                  role="cell"
                  className="py-3 pl-3 text-right whitespace-nowrap text-muted-foreground"
                >
                  {formatDate(p.timestamp)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid view — virtualized responsive rows with measured dynamic heights.
// ---------------------------------------------------------------------------

/** Mirror of the grid's responsive columns: 2 (base) / 3 (sm ≥640) / 4 (lg ≥1024). */
function getColumns(): number {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth >= 1024) return 4;
  if (window.innerWidth >= 640) return 3;
  return 2;
}

const GRID_COLS_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

function VirtualPostsGrid({
  posts,
  scrollSnapshotsRef,
}: VirtualViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(getColumns);

  // Keep the JS column count in sync with the CSS breakpoints on resize.
  useEffect(() => {
    const onResize = () => setColumns(getColumns());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Chunk posts into rows of `columns` so one virtual item is one visual grid
  // row; the responsive layout lives in the row's CSS grid, not in JS.
  const rowCount = Math.ceil(posts.length / columns);

  const virtualizer = useOverviewVirtualizer({
    posts,
    count: rowCount,
    // Cards are aspect-4/5 so a row is mostly image height; the exact height
    // (caption wrapping, metric wrap) is corrected by measureElement.
    estimateSize: () => 400,
    overscan: 3,
    getItemKey: (index) => posts[index * columns]?.id ?? index,
    containerRef,
    scrollSnapshotsRef,
  });

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const start = virtualRow.index * columns;
        return (
          <div
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
            }}
            className={GRID_COLS_CLASS}
          >
            {posts.slice(start, start + columns).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        );
      })}
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