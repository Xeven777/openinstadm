import { prisma } from "@/lib/db/client";
import { getDMQueue } from "@/lib/queue/client";
import { getWorkerAlerts, getWorkerHealth } from "@/lib/ops/worker-health";

/**
 * Shared server-side query for the production diagnostics page.
 *
 * Used by both the API route handler and the server-rendered Diagnostics page so
 * the health aggregation lives in exactly one place. Returns plain serializable
 * objects (Dates converted to ISO strings).
 */

export async function getDiagnosticsData(workspaceId: string) {
  const [
    queueCounts,
    workerHealth,
    workerAlerts,
    webhookFailures,
    dmFailures,
    tokenRefreshFailures,
    operationalEvents,
  ] = await Promise.all([
    getDMQueue().getJobCounts("waiting", "active", "delayed", "failed"),
    getWorkerHealth(),
    getWorkerAlerts(10),
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
    queueCounts,
    workerHealth,
    workerAlerts,
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
