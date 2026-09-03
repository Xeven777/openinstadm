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

  // Worker has a single serial reconciler + at most 5 concurrent jobs, so it
  // needs far fewer connections than the web dashboard (which fires ~16 queries
  // in parallel). A smaller pool + faster idle drain lets Neon pooled actually
  // suspend between polls instead of holding 10 warm connections at 0.02 CU.
  const isWorker = process.env.WORKER === "true" || process.env.ROLE === "worker";
  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? (isWorker ? 3 : 10));
  const idleTimeoutMillis = Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 10_000);

  // Neon pooled compute suspends when idle — wake-up can take 5-15s. A 10s
  // connection timeout fires before the compute is ready and surfaces as
  // "Connection terminated due to connection timeout" from pg. 30s gives the
  // cold start enough headroom while still failing fast on a real outage.
  const connectionTimeoutMillis = Number(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 30_000,
  );

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      // The dashboard stats aggregation fires ~16 queries in a single
      // Promise.all; a pool of 5 would queue them in 4 sequential waves and
      // add hundreds of ms of latency on a remote Postgres. 10 keeps them all
      // in flight while staying well within Neon's connection budget.
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
