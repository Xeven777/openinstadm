import { Suspense } from "react";
import { redirect } from "next/navigation";
// SSR build: plain-SVG icons that render in Server Components. The CSR build
// calls React.createContext at module scope and breaks the RSC build collector.
import {
  BellRingingIcon as BellRinging,
  ClockIcon as Clock,
  HourglassIcon as Hourglass,
  KeyIcon as Key,
  ListBulletsIcon as ListBullets,
  MegaphoneIcon as Megaphone,
  PlayIcon as Play,
  PulseIcon as Pulse,
  WebhooksLogoIcon as WebhooksLogo,
  XCircleIcon as XCircle,
} from "@phosphor-icons/react/dist/ssr";
import DiagnosticsRefresh from "@/components/diagnostics-refresh";
import StatusBadge from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import {
  getDiagnosticsOverview,
  getDiagnosticsSections,
} from "@/lib/server/diagnostics";

/**
 * Diagnostics Page (Server Component)
 *
 * Queries Redis queue counts + Postgres failure tables directly on every render
 * — no client fetch, no JSON round-trip. The only client island is the Refresh
 * button, which re-runs this component server-side via router.refresh().
 *
 * Rendered as two Suspense regions so the fast Redis reads (queue counts,
 * worker health, worker alerts) paint immediately while the Postgres failure
 * tables stream in behind them.
 */

const QUEUE_TILES = [
  { key: "waiting", label: "Waiting", icon: Hourglass },
  { key: "active", label: "Active", icon: Play },
  { key: "delayed", label: "Delayed", icon: Clock },
  { key: "failed", label: "Failed", icon: XCircle },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DiagnosticsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Diagnostics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Health, queues, webhook failures, billing events, and worker alerts.
          </p>
        </div>
        <DiagnosticsRefresh />
      </div>
      {/* Redis reads are near-instant: paint them first, stream Postgres after */}
      <Suspense fallback={<TilesSkeleton />}>
        <DiagnosticsOverview />
      </Suspense>
      <Suspense fallback={<SectionsSkeleton />}>
        <DiagnosticsSections />
      </Suspense>
    </div>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3" aria-busy="true">
      {[...Array(5)].map((_, i) => (
        <Card key={i} size="sm">
          <CardContent className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-7 rounded-md" />
            </div>
            <Skeleton className="h-7 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function DiagnosticsOverview() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/login");

  const { queueCounts, workerHealth, workerAlerts } =
    await getDiagnosticsOverview();

  const healthy = workerHealth.healthy;
  const workerAgeSeconds =
    workerHealth.ageMs == null ? null : Math.round(workerHealth.ageMs / 1000);

  return (
    <>
      {/* Health + queue tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardContent className="gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-muted-foreground">
                Worker health
              </p>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  healthy
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning",
                )}
              >
                <Pulse className="size-4" />
              </span>
            </div>
            <p
              className={cn(
                "text-2xl font-semibold tracking-tight text-foreground",
                healthy ? "text-success" : "text-warning",
              )}
            >
              {healthy ? "Healthy" : "Needs attention"}
            </p>
            <p className="text-xs text-muted-foreground">
              {workerAgeSeconds == null
                ? "No heartbeat found"
                : `Last heartbeat ${workerAgeSeconds}s ago`}
            </p>
          </CardContent>
        </Card>
        {QUEUE_TILES.map(({ key, label, icon: Icon }) => (
          <Card key={key} size="sm">
            <CardContent className="gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-muted-foreground">
                  Queue {label.toLowerCase()}
                </p>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              </div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                {queueCounts[key] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section title="Recent Worker Alerts" icon={BellRinging}>
        {workerAlerts.length ? (
          <div className="space-y-3">
            {workerAlerts.map((alert) => (
              <div
                key={`${alert.createdAt}-${alert.jobId ?? alert.message}`}
                className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/50 p-3 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 wrap-break-word text-sm font-medium text-foreground">
                    {alert.message}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatDate(alert.createdAt)}
                    {alert.commentId ? ` · ${alert.commentId}` : ""}
                  </p>
                </div>
                <Badge variant="destructive">{alert.level}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="No worker alerts recorded." />
        )}
      </Section>
    </>
  );
}

async function DiagnosticsSections() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/login");

  const {
    webhookFailures,
    dmFailures,
    tokenRefreshFailures,
    operationalEvents,
  } = await getDiagnosticsSections(workspaceId);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Campaign DM Failures And Skips" icon={Megaphone}>
          {dmFailures.length ? (
            <div className="space-y-3">
              {dmFailures.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {item.automation?.name ?? "Auto-reply"}
                    </p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {item.commentText}
                  </p>
                  {item.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">
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

        <Section title="Webhook Failures" icon={WebhooksLogo}>
          {webhookFailures.length ? (
            <div className="space-y-3">
              {webhookFailures.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-foreground">
                    {event.object ?? "Instagram webhook"}
                  </p>
                  <p className="mt-1 text-xs text-destructive">
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
        <Section title="Token Refresh Failures" icon={Key}>
          {tokenRefreshFailures.length ? (
            <div className="space-y-3">
              {tokenRefreshFailures.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-foreground">
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

      <Section title="Operational Event Timeline" icon={ListBullets}>
        {operationalEvents.length ? (
          <div className="space-y-3">
            {operationalEvents.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[140px_1fr_auto]"
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
