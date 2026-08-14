import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountUrlFilter from "@/components/account-url-filter";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import { getDashboardStats } from "@/lib/server/stats";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

/**
 * Dashboard Home Page (Server Component)
 *
 * Renders the stats tiles, 7-day chart, keywords, and recent activity directly
 * from the database — no client fetch, no JSON round-trip. The account filter
 * lives in the URL (`?instagramAccountId=`), so switching accounts is a plain
 * navigation that re-renders this component; the only client island is the
 * account `<select>`.
 *
 * Under cacheComponents the page's runtime work (session lookup, search params,
 * DB reads) is wrapped in a Suspense boundary so the static shell can prerender
 * and the content streams in at request time.
 */

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <div className="space-y-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true">
      <div className="h-8 w-64 rounded bg-muted/70" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-muted rounded p-5 h-32" />
        ))}
      </div>
      <div className="bg-muted rounded p-6 h-64" />
    </div>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  // One auth() session lookup + one membership query covers both the
  // workspace and the user — the previous code did two separate auth()
  // round trips (getCurrentWorkspaceId + getCurrentUserId).
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const selectedAccountId =
    typeof params.instagramAccountId === "string"
      ? params.instagramAccountId
      : "all";

  const stats = await getDashboardStats(
    context.workspaceId,
    context.userId,
    selectedAccountId === "all" ? null : selectedAccountId
  );

  const maxDM = Math.max(...stats.dailyDMs.map((d) => d.count), 1);
  const connectedCount = stats.instagramAccounts.length;

  return (
    <>
      {/* Greeting header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Hello, {stats.userName ?? "there"}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {connectedCount} connected{" "}
            {connectedCount === 1 ? "account" : "accounts"}
            {" · "}
            {stats.contactsCount}{" "}
            {stats.contactsCount === 1 ? "contact" : "contacts"}
            {" · "}
            <Link href="/logs" className="text-primary hover:underline">
              See activity
            </Link>
          </p>
        </div>
        {stats.instagramAccounts.length > 1 && (
          <AccountUrlFilter
            accounts={stats.instagramAccounts}
            value={selectedAccountId}
          />
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Active Campaigns" value={stats.activeAutomations} />
        <StatCard label="DMs Sent" value={stats.dmsSentMonth} />
        <StatCard label="Skipped" value={stats.dmsSkippedMonth} />
        <StatCard label="Failed" value={stats.dmsFailedMonth} />
        <StatCard label="Clicks" value={stats.clicksThisMonth} />
        <StatCard label="CTR" value={`${stats.ctrThisMonth}%`} />
      </div>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 sm:gap-6">
        {/* 7-Day Chart */}
        <div className="lg:col-span-3 bg-muted rounded p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground mb-6">
            DMs — Last 7 Days
          </h2>
          <div className="flex items-end gap-1.5 h-40 sm:gap-2">
            {stats.dailyDMs.map((day) => (
              <div
                key={day.date}
                className="min-w-0 flex-1 flex flex-col items-center gap-2"
              >
                <span className="text-xs text-muted-foreground font-medium">
                  {day.count}
                </span>
                <div
                  className="w-full rounded-sm bg-accent min-h-1"
                  style={{
                    height: `${Math.max((day.count / maxDM) * 100, 4)}%`,
                  }}
                />
                {/* Seven labels share a phone's width, so they must not wrap. */}
                <span className="w-full truncate text-center text-[10px] text-zinc-500">
                  {day.date}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Keywords */}
        <div className="lg:col-span-1 bg-muted rounded p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Top Keywords
          </h2>
          <div className="space-y-3">
            {stats.topKeywords.length === 0 && (
              <p className="text-sm text-muted-foreground py-8">
                No keyword matches yet
              </p>
            )}
            {stats.topKeywords.map((keyword) => (
              <div
                key={keyword.keyword}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {keyword.keyword}
                </span>
                <span className="text-xs text-muted-foreground">
                  {keyword.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-muted rounded p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {stats.recentLogs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet
              </p>
            )}
            {stats.recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    @{log.commenterName ?? "unknown"}
                  </p>
                  <p className="text-xs bg-linear-to-tl from-fuchsia-500 via-red-600 to-orange-400 text-transparent bg-clip-text truncate">
                    {log.instagramAccount
                      ? `@${log.instagramAccount.username} · `
                      : ""}
                    {log.commentText}
                  </p>
                </div>
                <StatusBadge status={log.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
