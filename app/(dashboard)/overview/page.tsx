/**
 * Instagram Overview Page (Server Component)
 *
 * Aggregate reach/engagement across your recent posts, plus a per-post table.
 * Views / reach / saved / shares come from Instagram media insights (requires
 * the insights permission); likes and comments are always available.
 *
 * The heavy lifting (Meta pagination + per-post insights + follower history) is
 * done server-side by `loadOverviewData`, served from a Postgres snapshot on
 * repeat visits. Account and range selectors live in the URL
 * (`?instagramAccountId=` / `?count=`), so changing them is plain navigation;
 * the only client islands are the range select, the refresh button, and the
 * lazily-loaded follower chart.
 */

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
// SSR build: plain-SVG icons that render in Server Components. The CSR build
// calls React.createContext at module scope and breaks the RSC build collector.
import {
  BookmarkSimple,
  ChatCircle,
  Eye,
  Heart,
  InstagramLogo,
  ShareNetwork,
  Users,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import AccountUrlFilter from "@/components/account-url-filter";
import CountUp from "@/components/count-up";
import OverviewFollowerChart from "@/components/overview-follower-chart";
import OverviewPostsView from "@/components/overview-posts-view";
import OverviewRangeSelect from "@/components/overview-range-select";
import OverviewRefresh from "@/components/overview-refresh";
import StatCard from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  loadOverviewData,
  parseOverviewCount,
  type OverviewResponse,
} from "@/lib/server/overview";
import { formatTimeAgo } from "@/lib/utils/time";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

// Allow time for paginated media + per-post insight calls on larger accounts.
export const maxDuration = 60;

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-3 h-6 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-52 w-full" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    </div>
  );
}

export default async function OverviewPage(props: PageProps<"/overview">) {
  return (
    <div className="space-y-8">
      {/* Stream the shell immediately; the data-dependent body (session lookup,
          URL params, and possibly a slow Meta fetch for a cold snapshot)
          renders inside this boundary at request time. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function OverviewContent({
  searchParams,
}: {
  searchParams: PageProps<"/overview">["searchParams"];
}) {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const selectedAccountId =
    typeof params.instagramAccountId === "string"
      ? params.instagramAccountId
      : "all";
  const countParam =
    typeof params.count === "string" ? params.count : undefined;
  const count = parseOverviewCount(countParam);

  const account = await getWorkspaceInstagramAccount(
    context.workspaceId,
    selectedAccountId === "all" ? null : selectedAccountId
  );

  if (!account) {
    return (
      <Card className="py-14">
        <CardContent className="items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <InstagramLogo className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            No Instagram account connected
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Connect an account to see reach, engagement and follower trends
            across your posts.
          </p>
          <Link
            href="/api/instagram/connect"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-2")}
          >
            Connect Instagram
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { data, snapshot } = await loadOverviewData({
    workspaceId: context.workspaceId,
    account,
    count,
  });

  return (
    <OverviewView
      data={data}
      fetchedAt={snapshot.fetchedAt}
      selectedAccountId={selectedAccountId}
      countParam={countParam ?? "50"}
    />
  );
}

function OverviewView({
  data,
  fetchedAt,
  selectedAccountId,
  countParam,
}: {
  data: OverviewResponse;
  fetchedAt: string;
  selectedAccountId: string;
  countParam: string;
}) {
  const {
    totals,
    posts,
    accounts,
    insightsAvailable,
    followers,
    followerHistory,
  } = data;

  const statTiles = [
    { label: "Views", value: totals.views, icon: <Eye weight="fill" className="size-4" /> },
    { label: "Reach", value: totals.reach, icon: <Users weight="fill" className="size-4" /> },
    { label: "Likes", value: totals.likes, icon: <Heart weight="fill" className="size-4" /> },
    { label: "Comments", value: totals.comments, icon: <ChatCircle weight="fill" className="size-4" /> },
    { label: "Saved", value: totals.saved, icon: <BookmarkSimple weight="fill" className="size-4" /> },
    { label: "Shares", value: totals.shares, icon: <ShareNetwork weight="fill" className="size-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.requestedCount === "all" ? "All-time" : "Recent"} performance
            for @{data.account.username}
            {data.truncated ? ` (capped at ${totals.posts} posts)` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {followers !== null && (
              // Kept out of the tile row below: that row sums the selected
              // posts, whereas this is a current account-level total.
              <span className="inline-flex items-center gap-1.5">
                <Users weight="fill" className="size-3.5 text-primary" />
                {followers.toLocaleString()} followers
              </span>
            )}
            <span className="text-muted-foreground/70">
              Last refreshed {formatTimeAgo(fetchedAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <OverviewRefresh
            selectedAccountId={selectedAccountId}
            count={data.requestedCount}
          />
          <OverviewRangeSelect value={countParam} />
          {accounts.length > 1 && (
            <AccountUrlFilter accounts={accounts} value={selectedAccountId} />
          )}
        </div>
      </div>

      {!insightsAvailable && (
        <Alert className="border-warning/30 bg-warning/5">
          <WarningCircle weight="fill" className="text-warning" />
          <AlertTitle>Insights permission missing</AlertTitle>
          <AlertDescription>
            Views, reach, saved and shares need the insights permission.
            Reconnect your account to grant it — likes and comments are shown in
            the meantime.
          </AlertDescription>
          <Link
            href="/api/instagram/connect"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Reconnect Instagram
          </Link>
        </Alert>
      )}

      {/* Aggregate totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {statTiles.map((tile) => (
          <StatCard
            key={tile.label}
            label={tile.label}
            icon={tile.icon}
            value={
              tile.value === null ? (
                "—"
              ) : (
                <CountUp value={tile.value} />
              )
            }
          />
        ))}
      </div>

      {/* Follower trend — account-level, independent of the post range */}
      <OverviewFollowerChart data={followerHistory} followers={followers} />

      {/* Per-post list — table or thumbnail grid, toggleable client-side */}
      <OverviewPostsView posts={posts} />
    </div>
  );
}
