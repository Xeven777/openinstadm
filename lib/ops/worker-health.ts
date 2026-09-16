/**
 * Job runner health and worker alerts.
 *
 * Both used to live in Redis (a heartbeat key with a TTL, and a capped alert
 * list). They are Postgres now, like the rest of the application state:
 *
 *   - the heartbeat is a single `RunnerHeartbeat` row upserted on every task run
 *   - alerts are the recent WORKER-level `OperationalEvent` rows that
 *     `recordJobFailure` already writes, so failures are stored once instead of
 *     twice
 */

import { prisma } from "@/lib/db/client";

const RUNNER_HEARTBEAT_ID = "dm";

// The signal changed with the move to a managed runner. It used to mean "a
// long-lived worker process heartbeated 120s ago"; it now means "a DM job ran
// recently", refreshed by every DM task and by the hourly comment sweep. The
// window therefore has to cover the sweep interval with margin — otherwise a
// quiet account would look unhealthy between comments — while still going stale
// within a couple of hours if the runner stops picking up jobs at all.
export const WORKER_HEARTBEAT_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface WorkerHeartbeat {
  status: "running";
  worker: "dm";
  pid?: number;
  hostname?: string;
  startedAt?: string;
  /** Task that refreshed the heartbeat, e.g. `process-comment`. */
  taskId?: string;
  /** Trigger.dev run id, for cross-referencing the dashboard. */
  runId?: string;
  checkedAt: string;
}

export interface WorkerHealth {
  healthy: boolean;
  heartbeat: WorkerHeartbeat | null;
  ageMs: number | null;
}

export interface WorkerAlert {
  level: "warning" | "error";
  message: string;
  jobId?: string;
  instagramAccountId?: string;
  commentId?: string;
  createdAt: string;
}

export async function recordWorkerHeartbeat(heartbeat: {
  pid?: number;
  hostname?: string;
  startedAt?: string;
  taskId?: string;
  runId?: string;
}): Promise<void> {
  const row = {
    taskId: heartbeat.taskId ?? null,
    runId: heartbeat.runId ?? null,
    hostname: heartbeat.hostname ?? null,
    pid: heartbeat.pid ?? null,
    startedAt: heartbeat.startedAt ? new Date(heartbeat.startedAt) : null,
  };

  await prisma.runnerHeartbeat.upsert({
    where: { id: RUNNER_HEARTBEAT_ID },
    create: { id: RUNNER_HEARTBEAT_ID, ...row },
    update: row,
  });
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  const row = await prisma.runnerHeartbeat.findUnique({
    where: { id: RUNNER_HEARTBEAT_ID },
  });

  if (!row) {
    return { healthy: false, heartbeat: null, ageMs: null };
  }

  const ageMs = Date.now() - row.checkedAt.getTime();

  return {
    healthy: ageMs <= WORKER_HEARTBEAT_WINDOW_MS,
    ageMs,
    heartbeat: {
      status: "running",
      worker: "dm",
      pid: row.pid ?? undefined,
      hostname: row.hostname ?? undefined,
      startedAt: row.startedAt?.toISOString(),
      taskId: row.taskId ?? undefined,
      runId: row.runId ?? undefined,
      checkedAt: row.checkedAt.toISOString(),
    },
  };
}

/**
 * Recent runner failures, newest first.
 *
 * Reads the WORKER OperationalEvent rows rather than a separate alert list, so
 * anything an operator sees here is also in the event log.
 */
export async function getWorkerAlerts(limit = 10): Promise<WorkerAlert[]> {
  const rows = await prisma.operationalEvent.findMany({
    where: { source: "WORKER", level: { in: ["ERROR", "WARNING"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { level: true, message: true, payload: true, createdAt: true },
  });

  return rows.map((row) => {
    const payload = (row.payload ?? {}) as {
      runId?: string;
      instagramAccountId?: string;
      commentId?: string;
    };

    return {
      level: row.level === "WARNING" ? ("warning" as const) : ("error" as const),
      message: row.message,
      jobId: payload.runId,
      instagramAccountId: payload.instagramAccountId,
      commentId: payload.commentId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
