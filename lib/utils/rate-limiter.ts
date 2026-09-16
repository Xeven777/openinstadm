/**
 * Rate Limiter
 *
 * Hourly cap on Instagram private replies, enforced with a Postgres counter.
 *
 * The cap matches Meta's documented limit for this exact call: 750 private
 * replies per hour per Instagram professional account, for comments on posts
 * and reels. Exceeding it risks 429s and app-level restrictions, so the handler
 * requeues rather than pushing through.
 * https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
 *
 * Note this is a hard ceiling with no headroom. If Meta throttles before the
 * documented limit, or other calls on the same account share the bucket, lower
 * this value.
 *
 * The counter used to be a Redis key incremented by a Lua script. It is now one
 * atomic upsert (`lib/db/window-counter.ts`), which keeps the property that
 * mattered: concurrent jobs cannot both pass the check and then both increment.
 */

import {
  claimWindowSlot,
  readWindowCount,
  resetWindowCounter,
} from "@/lib/db/window-counter";

const RATE_LIMIT_MAX = 750; // private replies per hour, per Meta's documented cap
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const REQUEUE_DELAY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_REQUEUE_ATTEMPTS = 3;

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  remainingDMs: number;
  shouldRequeue: boolean;
  requeueDelayMs: number;
  shouldSkip: boolean;
  reserved: boolean;
}

/** Counter key for one Instagram account. */
function rateLimitKey(instagramAccountId: string): string {
  return `dm:${instagramAccountId}`;
}

function blockedResult(
  count: number,
  requeueAttempt: number
): RateLimitResult {
  if (requeueAttempt >= MAX_REQUEUE_ATTEMPTS) {
    return {
      allowed: false,
      currentCount: count,
      remainingDMs: 0,
      shouldRequeue: false,
      requeueDelayMs: 0,
      shouldSkip: true,
      reserved: false,
    };
  }

  return {
    allowed: false,
    currentCount: count,
    remainingDMs: 0,
    shouldRequeue: true,
    requeueDelayMs: REQUEUE_DELAY_MS,
    shouldSkip: false,
    reserved: false,
  };
}

/**
 * Check whether an Instagram account is within its hourly DM limit, without
 * consuming a slot.
 *
 * Unlike `reserveDMSlot` this is not safe against a concurrent send: it only
 * reports what the counter says right now. Use it for diagnostics and admin
 * views; the worker path must reserve.
 */
export async function checkRateLimit(
  instagramAccountId: string,
  requeueAttempt: number = 0
): Promise<RateLimitResult> {
  const count = await readWindowCount(
    rateLimitKey(instagramAccountId),
    RATE_LIMIT_WINDOW
  );

  if (count >= RATE_LIMIT_MAX) {
    return blockedResult(count, requeueAttempt);
  }

  return {
    allowed: true,
    currentCount: count,
    remainingDMs: RATE_LIMIT_MAX - count,
    shouldRequeue: false,
    requeueDelayMs: 0,
    shouldSkip: false,
    reserved: false,
  };
}

/**
 * Atomically reserve a DM send slot for an Instagram account.
 * This is the worker-safe path; it prevents concurrent jobs from all passing
 * the rate-limit check before any of them increments the counter.
 *
 * @param instagramAccountId - The Instagram account ID to check
 * @param requeueAttempt - How many times this job has been requeued (0 = first attempt)
 * @returns Rate limit result with action recommendations
 */
export async function reserveDMSlot(
  instagramAccountId: string,
  requeueAttempt: number = 0
): Promise<RateLimitResult> {
  const claim = await claimWindowSlot({
    key: rateLimitKey(instagramAccountId),
    windowSeconds: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX,
  });

  if (!claim.allowed) {
    return blockedResult(claim.count, requeueAttempt);
  }

  return {
    allowed: true,
    currentCount: claim.count,
    remainingDMs: Math.max(0, RATE_LIMIT_MAX - claim.count),
    shouldRequeue: false,
    requeueDelayMs: 0,
    shouldSkip: false,
    reserved: true,
  };
}

/**
 * Backwards-compatible helper for tests and admin scripts.
 * Prefer reserveDMSlot in workers.
 */
export async function incrementDMCounter(
  instagramAccountId: string
): Promise<number> {
  const result = await reserveDMSlot(instagramAccountId, MAX_REQUEUE_ATTEMPTS);
  return result.currentCount;
}

/**
 * Get the current DM count for an Instagram account.
 */
export async function getCurrentDMCount(
  instagramAccountId: string
): Promise<number> {
  return readWindowCount(rateLimitKey(instagramAccountId), RATE_LIMIT_WINDOW);
}

/**
 * Reset the rate limiter for an account (useful for testing).
 */
export async function resetRateLimit(
  instagramAccountId: string
): Promise<void> {
  await resetWindowCounter(rateLimitKey(instagramAccountId));
}

// Export constants for use in tests
export { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, REQUEUE_DELAY_MS, MAX_REQUEUE_ATTEMPTS };
