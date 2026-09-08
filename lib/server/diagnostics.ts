import { prisma } from "@/lib/db/client";
import {
  getDMQueueForDiagnostics,
  withDiagnosticsRedisConnection,
} from "@/lib/queue/client";
import { getWorkerAlerts, getWorkerHealth } from "@/lib/ops/worker-health";

/**
 * Shared server-side queries for the production diagnostics page.
 *
 * The page is split into two Suspense regions so the fast Redis reads (queue
 * counts, worker health, worker alerts) paint before the slower Postgres
 * sections stream in:
 *
 *   - getDiagnosticsOverview() — Redis only (no DB round-trip)
 *   - getDiagnosticsSections() — Postgres failure tables
 *   - getDiagnosticsData()     — both combined, for the admin API route
 *
 * All functions return plain serializable objects (Dates converted to ISO
 * strings).
 */

export async function getDiagnosticsOverview() {
  try {
    return await withDiagnosticsRedisConnection(async (redis) => {
      const queue = getDMQueueForDiagnostics(redis);

      try {
        const [queueCounts, workerHealth, workerAlerts] = await Promise.all([
          queue.getJobCounts("waiting", "active", "delayed", "failed"),
          getWorkerHealth(redis),
          getWorkerAlerts(10, redis),
        ]);

        return {
          queueCounts,
          workerHealth,
          workerAlerts,
          redisAvailable: true,
          redisError: null,
        };
      } finally {
        await queue.close();
      }
    });
  } catch (error) {
    // The Diagnostics page is an operational aid. Redis outages should be
    // visible in the page rather than leaving its Suspense fallback on screen.
    console.error("[Diagnostics] Redis check failed", error);
    return {
      queueCounts: null,
      workerHealth: { healthy: false, heartbeat: null, ageMs: null },
      workerAlerts: [],
      redisAvailable: false,
      redisError: "Redis is unavailable.",
    };
  }
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
