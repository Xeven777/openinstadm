import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import {
  getDiagnosticsOverview,
  getDiagnosticsSections,
} from "@/lib/server/diagnostics";

/**
 * Temporary verification for the diagnostics index migration.
 *
 * This machine's DNS returns IPv6 first for Neon's pooler and the IPv6 route
 * is unreachable (ENETUNREACH), which hangs the pg adapter's happy-eyeballs
 * resolver. Pin the pooler IPv4 address directly (same DB, same TLS host via
 * SNI) to exercise the real queries against the live database.
 */

const url = new URL(process.env.DATABASE_URL!);
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    // Neon pooler: connect to a reachable IPv4, keep the DNS name for TLS SNI.
    // (No connectionString — pg would prefer it over these fields.)
    host: "52.43.156.152",
    port: 5432,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false, servername: url.hostname },
    connectionTimeoutMillis: 10_000,
    max: 2,
  }),
});

async function main() {
  // 1. Indexes present?
  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN (
      'WebhookEvent_workspaceId_status_createdAt_idx',
      'DmLog_workspaceId_status_updatedAt_idx',
      'OperationalEvent_workspaceId_source_level_createdAt_idx'
    )
    ORDER BY indexname
  `;
  console.log("Indexes found:", indexes.map((i) => i.indexname).join(", "));

  // 2. Loaders run without error
  const overview = await getDiagnosticsOverview();
  console.log("Overview OK:", {
    queueCounts: overview.queueCounts,
    workerHealthy: overview.workerHealth.healthy,
    workerAlerts: overview.workerAlerts.length,
  });

  const workspace = await prisma.workspace.findFirst({
    select: { id: true },
  });
  if (!workspace) {
    console.log("No workspace found — skipping sections check");
    return;
  }
  const sections = await getDiagnosticsSections(workspace.id);
  console.log("Sections OK:", {
    webhookFailures: sections.webhookFailures.length,
    dmFailures: sections.dmFailures.length,
    tokenRefreshFailures: sections.tokenRefreshFailures.length,
    operationalEvents: sections.operationalEvents.length,
  });
}

main()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
