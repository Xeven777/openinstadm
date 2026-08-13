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
import { redirect } from "next/navigation";
import AccountUrlFilter from "@/components/account-url-filter";
import OverviewFollowerChart from "@/components/overview-follower-chart";
import OverviewRangeSelect from "@/components/overview-range-select";
import OverviewRefresh from "@/components/overview-refresh";
import StatCard from "@/components/stat-card";
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

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-muted rounded p-4 h-24 sm:p-5">
          <div className="h-4 w-16 bg-zinc-200 rounded" />
          <div className="mt-3 h-6 w-20 bg-zinc-200/60 rounded" />
        </div>
      ))}
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
      <div className="bg-muted rounded p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Instagram account not connected. Please connect your account first.
        </p>
        <a
          href="/api/instagram/connect"
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          Connect Instagram
        </a>
      </div>
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
  const { totals, posts, accounts, insightsAvailable, followers, followerHistory } =
    data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.requestedCount === "all" ? "All-time" : "Recent"} —{" "}
            {totals.posts} post{totals.posts === 1 ? "" : "s"} from @
            {data.account.username}
            {data.truncated ? ` (capped at ${totals.posts})` : ""}
          </p>
          {followers !== null && (
            // Kept out of the tile row below: that row sums the selected posts,
            // whereas this is a current account-level total.
            <p className="mt-1 text-sm text-muted-foreground">
              {followers.toLocaleString()} followers
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground/80">
            Last refreshed {formatTimeAgo(fetchedAt)}
          </p>
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
        <div className="bg-muted rounded p-4 border border-border">
          <p className="text-sm text-foreground">
            Views, reach, saved and shares need the insights permission.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Reconnect your account to grant it — likes and comments are shown in
            the meantime.
          </p>
          <a
            href="/api/instagram/connect"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Reconnect Instagram
          </a>
        </div>
      )}

      {/* Aggregate totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Views" value={formatNumber(totals.views)} />
        <StatCard label="Reach" value={formatNumber(totals.reach)} />
        <StatCard label="Likes" value={formatNumber(totals.likes)} />
        <StatCard label="Comments" value={formatNumber(totals.comments)} />
        <StatCard label="Saved" value={formatNumber(totals.saved)} />
        <StatCard label="Shares" value={formatNumber(totals.shares)} />
      </div>

      {/* Follower trend — account-level, independent of the post range */}
      <OverviewFollowerChart data={followerHistory} followers={followers} />

      {/* Per-post table */}
      <div className="bg-muted rounded p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No posts found
          </p>
        ) : (
          // Eight metric columns can't compress into a phone; let the table keep
          // its natural width and scroll inside the panel instead.
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-border">
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
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 pr-4 max-w-xs">
                      {p.permalink ? (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-accent truncate block"
                        >
                          {p.caption || `${p.mediaType} post`}
                        </a>
                      ) : (
                        <span className="text-foreground truncate block">
                          {p.caption || `${p.mediaType} post`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {formatNumber(p.views)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {formatNumber(p.reach)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {formatNumber(p.likes)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {formatNumber(p.comments)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {formatNumber(p.saved)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">
                      {formatNumber(p.shares)}
                    </td>
                    <td className="py-3 pl-3 text-right text-zinc-500">
                      {formatDate(p.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
