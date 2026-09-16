import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDiagnosticsOverview } from "@/lib/server/diagnostics";

// Health must reflect live state (job activity, queue depth), never a cached
// response, or it reports stale runner activity. Under cacheComponents the
// handler stays request-time dynamic automatically: its database and runner API
// checks are runtime data access, which terminates prerendering.

type CheckStatus = "ok" | "error";

interface HealthCheck {
  status: CheckStatus;
  detail?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

export async function GET() {
  const [database, diagnostics] = await Promise.all([
    checkDatabase(),
    getDiagnosticsOverview(),
  ]);

  // Queue depth now comes from the job runner (Trigger.dev) rather than from a
  // Redis-backed BullMQ queue, but the check name and payload shape are kept so
  // existing monitors keep working.
  const queue: HealthCheck & { counts?: unknown } = diagnostics.queueCounts
    ? { status: "ok", counts: diagnostics.queueCounts }
    : {
        status: "error",
        detail: diagnostics.runnerError ?? "Queue check failed",
      };
  const worker = diagnostics.workerHealth;

  const healthy =
    database.status === "ok" &&
    queue.status === "ok" &&
    worker.healthy;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        database,
        queue,
        worker,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, must-revalidate" },
    }
  );
}
