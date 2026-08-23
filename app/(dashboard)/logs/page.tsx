import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
// SSR build: plain-SVG icons that render in Server Components. The CSR build
// calls React.createContext at module scope and breaks the RSC build collector.
import { ArrowLeft, ArrowRight, Megaphone } from "@phosphor-icons/react/dist/ssr";
import AccountUrlFilter from "@/components/account-url-filter";
import StatusBadge from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getLogsPage } from "@/lib/server/logs";
import { getWorkspaceAccounts } from "@/lib/server/settings";

/**
 * DM Logs Page (Server Component)
 *
 * The status filter, account filter, and pagination all live in the URL query
 * string, so changing any of them is a plain navigation that re-renders this
 * server component against the database — no client fetch, no JSON round-trip.
 * The only client island is the account `<select>` (it must push navigation on
 * change); everything else is server-rendered markup.
 *
 * Under cacheComponents the page's runtime work (session lookup, search params,
 * DB reads) is wrapped in a Suspense boundary so the static shell can prerender
 * and the content streams in at request time.
 */

const STATUS_FILTERS = [
  "ALL",
  "SENT",
  "FAILED",
  "PENDING",
  "SKIPPED_RATE_LIMIT",
  "SKIPPED_PLAN_LIMIT",
  "SKIPPED_DEDUP",
];

const STATUS_LABELS: Record<string, string> = {
  ALL: "All",
  SENT: "Sent",
  FAILED: "Failed",
  PENDING: "Pending",
  SKIPPED_RATE_LIMIT: "Rate limit",
  SKIPPED_PLAN_LIMIT: "Plan limit",
  SKIPPED_DEDUP: "Dedup",
};

function statusLabel(status: string): string {
  return (
    STATUS_LABELS[status] ??
    status.replace(/^SKIPPED_/, "").replace(/_/g, " ")
  );
}

function commenterInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function LogsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs ring-1 ring-foreground/10">
        <Skeleton className="h-11 w-full rounded-none" />
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}

export default async function LogsPage(props: PageProps<"/logs">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<LogsSkeleton />}>
        <LogsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function LogsContent({
  searchParams,
}: {
  searchParams: PageProps<"/logs">["searchParams"];
}) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/login");

  const params = await searchParams;
  const rawPage = params.page;
  const page = Math.max(1, Number.parseInt(String(rawPage ?? "1"), 10) || 1);
  const statusFilter =
    typeof params.status === "string" ? params.status : "ALL";
  const selectedAccountId =
    typeof params.instagramAccountId === "string"
      ? params.instagramAccountId
      : "all";

  const [accounts, result] = await Promise.all([
    getWorkspaceAccounts(workspaceId),
    getLogsPage(workspaceId, {
      page,
      limit: 20,
      status: statusFilter,
      instagramAccountId: selectedAccountId,
    }),
  ]);

  const { logs, pagination } = result;

  function filterHref({
    nextStatus = statusFilter,
    nextAccount = selectedAccountId,
    nextPage = 1,
  }: {
    nextStatus?: string;
    nextAccount?: string;
    nextPage?: number;
  }) {
    const params = new URLSearchParams();
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    if (nextAccount !== "all") params.set("instagramAccountId", nextAccount);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return `/logs${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            DM Logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every automated DM sent or skipped across your campaigns.
          </p>
        </div>
        {accounts.length > 1 && (
          <AccountUrlFilter
            accounts={accounts.map((account) => ({
              id: account.id,
              username: account.username,
              instagramId: account.instagramId,
              name: account.name,
            }))}
            value={selectedAccountId}
          />
        )}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <Link
            key={status}
            href={filterHref({ nextStatus: status })}
            aria-current={statusFilter === status ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-full border text-xs font-medium",
              statusFilter === status
                ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            {statusLabel(status)}
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {/* Six columns don't fit a phone; the table keeps its width and
              scrolls horizontally inside the panel rather than crushing every
              cell. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Commenter
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Comment
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Campaign
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Account
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground sm:px-6"
                    >
                      No logs found
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {commenterInitial(
                              log.commenterName ??
                                log.commenterId.slice(0, 8),
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">
                          @{log.commenterName ?? log.commenterId.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-3 sm:px-6">
                      <span
                        className="block truncate text-muted-foreground"
                        title={log.commentText}
                      >
                        {log.commentText}
                      </span>
                      {log.status === "FAILED" && log.errorMessage && (
                        <span
                          className="mt-0.5 block truncate text-xs text-destructive"
                          title={log.errorMessage}
                        >
                          {log.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Megaphone className="size-3.5 shrink-0" />
                        {log.automation.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground sm:px-6">
                      @{log.instagramAccount.username}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground sm:px-6">
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
              <p className="text-xs text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Link
                  aria-disabled={page <= 1}
                  href={filterHref({ nextPage: page - 1 })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "aria-disabled:pointer-events-none aria-disabled:opacity-40",
                  )}
                >
                  <ArrowLeft
                    data-icon="inline-start"
                    className="size-3.5"
                  />
                  Previous
                </Link>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  {page} / {pagination.totalPages}
                </span>
                <Link
                  aria-disabled={page >= pagination.totalPages}
                  href={filterHref({ nextPage: page + 1 })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "aria-disabled:pointer-events-none aria-disabled:opacity-40",
                  )}
                >
                  Next
                  <ArrowRight data-icon="inline-end" className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
