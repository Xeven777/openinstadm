/**
 * Fixed-window counters in Postgres.
 *
 * Replaces the Redis counters (`rate:dm:<account>`, `ai:budget:<workspace>`).
 * What matters here is the same property the old Lua script had: claiming a slot
 * is a single atomic statement, so two concurrent jobs can never both take the
 * last slot. Prisma can't express that as a model call, so it is one upsert.
 *
 * The window rolls lazily — the first claim after `windowSeconds` of inactivity
 * resets the count — which matches a Redis key with a TTL set on first write.
 */

import { prisma } from "@/lib/db/client";

// Postgres integer ceiling, used as "no cap" for counters that only measure.
const UNCAPPED = 2_147_483_647;

export interface WindowClaim {
  /** False when the window is full; nothing was counted. */
  allowed: boolean;
  /** Count including this claim when `allowed`, otherwise the capped count. */
  count: number;
  /** Start of the window this claim belongs to, or null when it was denied. */
  windowStart: Date | null;
}

export interface ClaimOptions {
  key: string;
  /** Length of the window in seconds. */
  windowSeconds: number;
  /** Maximum claims per window. */
  max: number;
}

/**
 * Claim one slot in a counter's current window.
 *
 * Runs `INSERT ... ON CONFLICT DO UPDATE ... WHERE` so the count, the window
 * rollover, and the cap check all happen under the row lock. The `WHERE` clause
 * is what enforces the cap: when it fails, no row is updated and no row is
 * returned, which is the "denied" result.
 */
export async function claimWindowSlot({
  key,
  windowSeconds,
  max,
}: ClaimOptions): Promise<WindowClaim> {
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "WindowCounter" ("key", "windowStart", "count", "updatedAt")
    VALUES (${key}, now(), 1, now())
    ON CONFLICT ("key") DO UPDATE
      SET "count" = CASE
            WHEN "WindowCounter"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::double precision)
              THEN 1
            ELSE "WindowCounter"."count" + 1
          END,
          "windowStart" = CASE
            WHEN "WindowCounter"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::double precision)
              THEN now()
            ELSE "WindowCounter"."windowStart"
          END,
          "updatedAt" = now()
      WHERE "WindowCounter"."windowStart" <= now() - make_interval(secs => ${windowSeconds}::double precision)
         OR "WindowCounter"."count" < ${max}
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  if (!row) {
    return { allowed: false, count: max, windowStart: null };
  }

  return { allowed: true, count: row.count, windowStart: row.windowStart };
}

/**
 * Read the current count without claiming anything.
 *
 * An expired window reads as 0 — same as a Redis key that has TTL'd out.
 */
export async function readWindowCount(
  key: string,
  windowSeconds: number
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT "count"
    FROM "WindowCounter"
    WHERE "key" = ${key}
      AND "windowStart" > now() - make_interval(secs => ${windowSeconds}::double precision)
  `;

  return rows[0]?.count ?? 0;
}

/** Increment without a cap. Returns the count after incrementing. */
export async function recordWindowEvent(
  key: string,
  windowSeconds: number
): Promise<number> {
  const claim = await claimWindowSlot({ key, windowSeconds, max: UNCAPPED });
  return claim.count;
}

/** Delete a counter's row, restarting its window. Used by tests and admin tools. */
export async function resetWindowCounter(key: string): Promise<void> {
  await prisma.windowCounter.deleteMany({ where: { key } });
}
