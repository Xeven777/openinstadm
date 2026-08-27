import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  HandWavingIcon,
  InstagramLogoIcon,
  Megaphone,
  PaperPlaneTilt,
  RocketLaunchIcon,
} from "@phosphor-icons/react/dist/ssr";
import AccountUrlFilter from "@/components/account-url-filter";
import CountUp from "@/components/count-up";
import StatusBadge from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getDashboardInsights, getDashboardSummary } from "@/lib/server/stats";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

/**
 * Dashboard Home Page (Server Component)
 *
 * Renders in two independently-streaming regions:
 *
 *  1. Summary — greeting, hero metrics, and the secondary metric strip. Cheap
 *     reads (counts), cached 120s, so this paints almost immediately.
 *  2. Insights — 7-day chart, top keywords, recent activity. Heavier reads,
 *     cached 5 min; streams in after the summary.
 *
 * Each region is its own Suspense boundary, so the browser paints the summary
 * while the insights region is still being computed on the server. Client
 * islands: the account `<select>`, the count-up numbers, and the lazily-loaded
 * chart (recharts bundle deferred until the region streams).
 */

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<SummarySkeleton />}>
        <SummaryRegion searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsRegion searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid gap-4  lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-xs">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-10 w-24" />
          <Skeleton className="mt-3 h-4 w-48" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-10 w-24" />
          <Skeleton className="mt-3 h-2 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-card px-5 py-4 shadow-xs sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 ">
      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6 shadow-xs">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-44 w-full" />
      </div>
      <div className="lg:col-span-1 rounded-xl border border-border bg-card p-6 shadow-xs">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-xs">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

const DashboardChart = dynamic(() => import("@/components/dashboard-chart"), {
  loading: () => (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-44 w-full" />
    </div>
  ),
});

async function SummaryRegion({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const selectedAccountId =
    typeof params.instagramAccountId === "string"
      ? params.instagramAccountId
      : "all";

  const stats = await getDashboardSummary(
    context.workspaceId,
    context.userId,
    selectedAccountId === "all" ? null : selectedAccountId,
  );

  // const connectedCount = stats.instagramAccounts.length;
  const campaignPct = Math.min(
    Math.round(
      (stats.activeAutomations / Math.max(stats.totalAutomations, 1)) * 100,
    ),
    100,
  );

  return (
    <>
      {/* Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tighter text-foreground sm:text-3xl lg:text-4xl inline-flex items-center gap-2">
            Hello,{" "}
            <span className="bg-linear-to-br from-primary to-foreground bg-clip-text text-transparent">
              {stats.userName ?? "there"}!
            </span>
            <span>
              <HandWavingIcon
                className="size-8 text-yellow-400 wobble-hor-bottom"
                weight="duotone"
              />
            </span>
          </h1>
          {/* <p className="mt-1 text-sm text-muted-foreground">
            {connectedCount} connected{" "}
            {connectedCount === 1 ? "account" : "accounts"}
          </p> */}
        </div>
        {stats.instagramAccounts.length > 1 && (
          <AccountUrlFilter
            accounts={stats.instagramAccounts}
            value={selectedAccountId}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="bg-linear-to-b from-lime-200 dark:from-lime-500 to-lime-300 text-black border-2 shadow-[0_10px_28px_rgba(132,204,22,0.3)]"
          style={{
            boxShadow: "inset 0 10px 20px lab(99 2.34 0.77 / 0.3)",
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <InstagramLogoIcon weight="duotone" className="size-5" />
              Get Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-[-7%] leading-tight">
              Create New <span className="italic font-bold">Campaign!</span>
            </p>
            <Link
              href="/campaigns/new"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "h-12 justify-center rounded-full text-base tracking-tight bg-linear-to-b from-secondary dark:to-black to-white px-6 mt-4 dark:shadow-[0_2px_0_1px_var(--secondary)]",
              )}
            >
              Lets Go <RocketLaunchIcon className="size-4 ml-2" weight="bold" />
            </Link>
          </CardContent>
        </Card>

        <Card className="relative">
          <div className="absolute w-2/5 h-4/5 bg-lime-700/30 -top-20 -right-30 pointer pointer-events-none rounded-full blur-3xl"></div>
          <div className="absolute w-2/5 h-4/5 bg-lime-700/30 -bottom-20 -left-30 pointer pointer-events-none rounded-full blur-3xl"></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PaperPlaneTilt weight="fill" className="size-4 text-primary" />
              DMs sent this week
            </CardTitle>
            <CardAction>
              <Link
                href="/logs"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                View logs
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
              <CountUp value={stats.dmsSentWeek} />
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                Today:{" "}
                <span className="font-semibold text-foreground">
                  <CountUp value={stats.dmsSentToday} />
                </span>
              </span>
              <span>
                This month:{" "}
                <span className="font-semibold text-foreground">
                  <CountUp value={stats.dmsSentMonth} />
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative">
          <div className="absolute w-2/5 h-4/5 bg-lime-700/30 top-20 -right-30 pointer pointer-events-none rounded-full blur-3xl"></div>
          <div className="absolute w-2/5 h-4/5 bg-lime-700/30 bottom-20 -left-30 pointer pointer-events-none rounded-full blur-3xl"></div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone weight="fill" className="size-4 text-primary" />
              Active campaigns
            </CardTitle>
            <CardAction>
              <Link
                href="/campaigns"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
              <CountUp value={stats.activeAutomations} />
              <span className="text-lg font-medium text-muted-foreground">
                {" "}
                / {stats.totalAutomations}
              </span>
            </p>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={stats.activeAutomations}
              aria-valuemin={0}
              aria-valuemax={stats.totalAutomations}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${campaignPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {campaignPct}% of campaigns running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary metric strip — engagement + audience + health, no card boxes. */}
      <div className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-card px-5 py-4 shadow-xs sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-border">
        <div className="sm:px-5 sm:first:pl-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Clicks this month
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            <CountUp value={stats.clicksThisMonth} />
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:px-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Click-through rate
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            <CountUp value={stats.ctrThisMonth} decimals={1} />
            <span className="text-sm font-medium text-muted-foreground">%</span>
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:px-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contacts
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            <CountUp value={stats.contactsCount} />
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:px-5 sm:last:pr-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Failed this month
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${
              stats.dmsFailedMonth > 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            <CountUp value={stats.dmsFailedMonth} />
          </p>
        </div>
      </div>
    </>
  );
}

async function InsightsRegion({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const selectedAccountId =
    typeof params.instagramAccountId === "string"
      ? params.instagramAccountId
      : "all";

  const stats = await getDashboardInsights(
    context.workspaceId,
    selectedAccountId === "all" ? null : selectedAccountId,
  );

  const maxKeyword = Math.max(...stats.topKeywords.map((k) => k.count), 0);

  return (
    <>
      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 ">
        {/* 7-Day Chart */}
        <div className="lg:col-span-3">
          <DashboardChart data={stats.dailyDMs} />
        </div>

        {/* Top Keywords */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Top keywords</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topKeywords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No keyword matches yet
                </p>
              ) : (
                <div className="space-y-4">
                  {stats.topKeywords.map((keyword) => (
                    <div key={keyword.keyword} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-foreground">
                          {keyword.keyword}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {keyword.count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{
                            width: `${maxKeyword ? (keyword.count / maxKeyword) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentLogs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No activity yet
                </p>
              ) : (
                <div className="max-h-64 divide-y divide-border overflow-y-auto pr-1">
                  {stats.recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          @{log.commenterName ?? "unknown"}
                          {log.automation && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              via {log.automation.name}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs bg-linear-to-tl from-fuchsia-500 via-red-600 to-orange-400 text-transparent bg-clip-text">
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
