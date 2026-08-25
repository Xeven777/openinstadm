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

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10_000,
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
