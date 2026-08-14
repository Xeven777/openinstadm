import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountUrlFilter from "@/components/account-url-filter";
import StatusBadge from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentWorkspaceId } from "@/lib/auth";
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

function LogsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <div className="bg-muted rounded overflow-hidden">
        <Skeleton className="h-12 w-full rounded-none" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none" />
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
    <>
      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <Link
              key={status}
              href={filterHref({ nextStatus: status })}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  statusFilter === status
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "bg-muted text-muted-foreground border border-border hover:border-foreground/20 hover:text-foreground"
                }
              `}
            >
              {status === "ALL"
                ? "All"
                : status.replace("SKIPPED_", "").replace("_", " ")}
            </Link>
          ))}
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

      {/* Table */}
      <div className="bg-muted rounded overflow-hidden">
        {/* Six columns don't fit a phone; the table keeps its width and scrolls
            horizontally inside the panel rather than crushing every cell. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:px-6">
                  Commenter
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:px-6">
                  Comment
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:px-6">
                  Campaign
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:px-6">
                  Account
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:px-6">
                  Status
                </th>
                <th className="px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider sm:px-6">
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
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-4 sm:px-6">
                    <span className="font-medium text-foreground">
                      @{log.commenterName ?? log.commenterId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-4 max-w-[200px] sm:px-6">
                    <span className="text-muted-foreground truncate block">
                      {log.commentText}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className="text-muted-foreground">
                      {log.automation.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className="text-muted-foreground">
                      @{log.instagramAccount.username}
                    </span>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-4 text-muted-foreground whitespace-nowrap sm:px-6">
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-t border-border sm:px-6">
            <p className="text-xs text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={page <= 1}
                href={filterHref({ nextPage: page - 1 })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/20 transition-all aria-disabled:opacity-30 aria-disabled:pointer-events-none"
              >
                Previous
              </Link>
              <span className="text-xs text-muted-foreground px-2">
                {page} / {pagination.totalPages}
              </span>
              <Link
                aria-disabled={page >= pagination.totalPages}
                href={filterHref({ nextPage: page + 1 })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/20 transition-all aria-disabled:opacity-30 aria-disabled:pointer-events-none"
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
