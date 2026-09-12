import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDiagnosticsOverview } from "@/lib/server/diagnostics";

// Health must reflect live state (worker heartbeat, queue depth), never a
// cached response, or it reports stale worker start times. Under cacheComponents
// the handler stays request-time dynamic automatically: its database and Redis
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

  const redis: HealthCheck = diagnostics.redisAvailable
    ? { status: "ok" }
    : { status: "error", detail: diagnostics.redisError ?? "Redis check failed" };
  const queue: HealthCheck & { counts?: unknown } = diagnostics.queueCounts
    ? { status: "ok", counts: diagnostics.queueCounts }
    : {
        status: "error",
        detail: diagnostics.redisError ?? "Queue check failed",
      };
  const worker = diagnostics.workerHealth;

  const healthy =
    database.status === "ok" &&
    redis.status === "ok" &&
    queue.status === "ok" &&
    worker.healthy;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        database,
        redis,
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
