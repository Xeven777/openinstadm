import { Suspense } from "react";
import { redirect } from "next/navigation";
import DiagnosticsRefresh from "@/components/diagnostics-refresh";
import StatusBadge from "@/components/status-badge";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getDiagnosticsData } from "@/lib/server/diagnostics";

/**
 * Diagnostics Page (Server Component)
 *
 * Queries Redis queue counts + Postgres failure tables directly on every render
 * — no client fetch, no JSON round-trip. The only client island is the Refresh
 * button, which re-runs this component server-side via router.refresh().
 */

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="py-5 text-center text-sm text-muted-foreground">{label}</p>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-muted rounded p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DiagnosticsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Production Diagnostics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Health, queues, webhook failures, billing events, and worker alerts.
          </p>
        </div>
        <DiagnosticsRefresh />
      </div>
      <Suspense fallback={<div className="bg-muted rounded p-8 h-64" />}>
        <DiagnosticsContent />
      </Suspense>
    </div>
  );
}

async function DiagnosticsContent() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/login");

  const data = await getDiagnosticsData(workspaceId);

  const workerAgeSeconds =
    data.workerHealth.ageMs == null
      ? null
      : Math.round(data.workerHealth.ageMs / 1000);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <div className="bg-muted rounded p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Worker health
          </p>
          <p
            className={`mt-3 text-2xl font-bold ${
              data.workerHealth.healthy ? "text-success" : "text-warning"
            }`}
          >
            {data.workerHealth.healthy ? "Healthy" : "Needs attention"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {workerAgeSeconds == null
              ? "No heartbeat found"
              : `Last heartbeat ${workerAgeSeconds}s ago`}
          </p>
        </div>
        {["waiting", "active", "delayed", "failed"].map((key) => (
          <div key={key} className="bg-muted rounded p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Queue {key}
            </p>
            <p className="mt-3 text-2xl font-bold text-foreground">
              {data.queueCounts[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <Section title="Recent Worker Alerts">
        {data.workerAlerts.length ? (
          <div className="space-y-3">
            {data.workerAlerts.map((alert) => (
              <div
                key={`${alert.createdAt}-${alert.jobId ?? alert.message}`}
                className="rounded border border-border bg-muted/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">
                    {alert.message}
                  </p>
                  <span className="shrink-0 rounded-full bg-error/10 px-2 py-1 text-xs font-semibold text-error">
                    {alert.level}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(alert.createdAt)}
                  {alert.commentId ? ` · ${alert.commentId}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No worker alerts recorded." />
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Campaign DM Failures And Skips">
          {data.dmFailures.length ? (
            <div className="space-y-3">
              {data.dmFailures.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-border pb-3 last:border-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {item.automation.name}
                    </p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {item.commentText}
                  </p>
                  {item.errorMessage && (
                    <p className="mt-1 text-xs text-error">
                      {item.errorMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No DM failures or skips." />
          )}
        </Section>

        <Section title="Webhook Failures">
          {data.webhookFailures.length ? (
            <div className="space-y-3">
              {data.webhookFailures.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-border pb-3 last:border-0"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {event.object ?? "Instagram webhook"}
                  </p>
                  <p className="mt-1 text-xs text-error">
                    {event.errorMessage ?? "Unknown error"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No failed webhook events." />
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Token Refresh Failures">
          {data.tokenRefreshFailures.length ? (
            <div className="space-y-3">
              {data.tokenRefreshFailures.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-border pb-3 last:border-0"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {event.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No token refresh failures." />
          )}
        </Section>
      </div>

      <Section title="Operational Event Timeline">
        {data.operationalEvents.length ? (
          <div className="space-y-3">
            {data.operationalEvents.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 border-b border-border pb-3 last:border-0 sm:grid-cols-[140px_1fr_auto]"
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {event.source}
                </p>
                <p className="text-sm text-foreground">{event.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No operational events recorded." />
        )}
      </Section>
    </>
  );
}
