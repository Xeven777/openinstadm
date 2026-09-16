import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // The job runner (set `WORKER=true` in its environment) handles at most 5
  // concurrent jobs plus the hourly reconciliation sweep, so it needs far fewer
  // connections than the web dashboard. Small pools + a fast idle drain let
  // Neon pooled actually suspend between jobs instead of holding warm
  // connections at 0.02 CU. Trade-off: the dashboard stats aggregation fires
  // ~16 queries in parallel, so a pool of 5 runs them in ~4 waves — a few
  // hundred ms slower on cold loads, in exchange for much shorter Neon wake
  // windows.
  const isWorker =
    process.env.WORKER === "true" || process.env.ROLE === "worker";
  const poolMax = isWorker ? 2 : 5;
  const idleTimeoutMillis = 5_000;

  // Neon pooled compute suspends when idle — wake-up can take 5-15s. A 10s
  // connection timeout fires before the compute is ready and surfaces as
  // "Connection terminated due to connection timeout" from pg. 30s gives the
  // cold start enough headroom while still failing fast on a real outage.
  const connectionTimeoutMillis = 30_000;

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      // See above: 5 keeps the dashboard's parallel aggregation to ~4 waves
      // while staying well within Neon's connection budget.
      max: poolMax,
    }),
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});

export function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Connection terminated due to connection timeout/i.test(message) ||
    /connection timeout/i.test(message) ||
    /Can't reach database server/i.test(message) ||
    /connect ETIMEDOUT/i.test(message) ||
    /ConnectionResetError/i.test(message)
  );
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 800,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isTransientDbError(error)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return withDbRetry(fn, retries - 1, delayMs * 2);
    }
    throw error;
  }
}
