import { prisma } from "@/lib/db/client";
import {
  getRunnerQueueCounts,
  isRunnerConfigured,
  type RunnerQueueCounts,
} from "@/lib/jobs/runner-stats";
import { getWorkerAlerts, getWorkerHealth } from "@/lib/ops/worker-health";

/**
 * Shared server-side queries for the production diagnostics page.
 *
 * The page is split into two Suspense regions so the fast reads (runner queue
 * counts, job activity, worker alerts) paint before the slower Postgres
 * sections stream in:
 *
 *   - getDiagnosticsOverview() — runner API + two small Postgres reads
 *   - getDiagnosticsSections() — Postgres failure tables
 *   - getDiagnosticsData()     — both combined, for the admin API route
 *
 * All functions return plain serializable objects (Dates converted to ISO
 * strings).
 */

export interface DiagnosticsOverview {
  queueCounts: RunnerQueueCounts | null;
  runnerAvailable: boolean;
  runnerError: string | null;
  workerHealth: Awaited<ReturnType<typeof getWorkerHealth>>;
  workerAlerts: Awaited<ReturnType<typeof getWorkerAlerts>>;
}

export async function getDiagnosticsOverview(): Promise<DiagnosticsOverview> {
  // The runner API is the one source that is external to this app, so it is the
  // only one that degrades instead of failing: an outage there should show as
  // unavailable tiles, not as a broken diagnostics page. The two Postgres reads
  // are left to fail loudly — if the database is down, the rest of the page is
  // gone anyway.
  const [runner, workerHealth, workerAlerts] = await Promise.all([
    getRunnerQueueCounts().then(
      (counts) => ({ counts, error: null as string | null }),
      (error: unknown) => {
        console.error("[Diagnostics] Runner check failed", error);
        return {
          counts: null,
          error: isRunnerConfigured()
            ? "The job runner is unreachable."
            : "TRIGGER_SECRET_KEY is not set, so run counts are unavailable.",
        };
      }
    ),
    getWorkerHealth(),
    getWorkerAlerts(10),
  ]);

  return {
    queueCounts: runner.counts,
    runnerAvailable: runner.counts !== null,
    runnerError: runner.error,
    workerHealth,
    workerAlerts,
  };
}

export async function getDiagnosticsSections(workspaceId: string) {
  const [
    webhookFailures,
    dmFailures,
    tokenRefreshFailures,
    operationalEvents,
  ] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { workspaceId, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        object: true,
        errorMessage: true,
        createdAt: true,
        processedAt: true,
      },
    }),
    prisma.dmLog.findMany({
      where: {
        workspaceId,
        status: {
          in: [
            "FAILED",
            "SKIPPED_RATE_LIMIT",
            "SKIPPED_PLAN_LIMIT",
            "SKIPPED_NO_MATCH",
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        commentId: true,
        commentText: true,
        errorMessage: true,
        updatedAt: true,
        automation: { select: { name: true } },
      },
    }),
    prisma.operationalEvent.findMany({
      where: { workspaceId, source: "TOKEN_REFRESH", level: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        message: true,
        createdAt: true,
        payload: true,
      },
    }),
    prisma.operationalEvent.findMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        source: true,
        level: true,
        message: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
  ]);

  return {
    webhookFailures: webhookFailures.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
      processedAt: event.processedAt?.toISOString() ?? null,
    })),
    dmFailures: dmFailures.map((failure) => ({
      ...failure,
      updatedAt: failure.updatedAt.toISOString(),
    })),
    tokenRefreshFailures: tokenRefreshFailures.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    operationalEvents: operationalEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
    })),
  };
}

export async function getDiagnosticsData(workspaceId: string) {
  const [overview, sections] = await Promise.all([
    getDiagnosticsOverview(),
    getDiagnosticsSections(workspaceId),
  ]);

  return { ...overview, ...sections };
}
