/**
 * BullMQ Queue Client
 *
 * Provides the DM processing queue and Redis connection for BullMQ.
 */

import { Queue } from "bullmq";
import Redis from "ioredis";

let connection: Redis | null = null;

// Dashboard requests must fail promptly when Redis is unavailable. This is
// deliberately separate from the shared BullMQ connection below: workers need
// `maxRetriesPerRequest: null` for their long-running blocking operations,
// whereas a streamed Server Component must never wait forever for Redis.
const DIAGNOSTIC_REDIS_TIMEOUT_MS = 3_000;

export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });
  }
  return connection;
}

/**
 * Run a short-lived, bounded Redis operation for request-time diagnostics.
 *
 * Do not use this for queue producers or workers. A failed request should
 * render a degraded state after a few seconds, while BullMQ keeps its own
 * persistent connection and retry policy.
 */
export async function withDiagnosticsRedisConnection<T>(
  operation: (redis: Redis) => Promise<T>,
): Promise<T> {
  const redis = new Redis(process.env.REDIS_URL!, {
    lazyConnect: true,
    connectTimeout: DIAGNOSTIC_REDIS_TIMEOUT_MS,
    commandTimeout: DIAGNOSTIC_REDIS_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  // Errors are also returned by connect()/commands below. Registering a
  // listener prevents ioredis from producing an unhandled EventEmitter error
  // while this short-lived probe is being torn down.
  redis.on("error", () => undefined);

  try {
    await redis.connect();
    return await operation(redis);
  } finally {
    redis.disconnect(false);
  }
}

// ─── DM Queue ───────────────────────────────────────────────────────────────────

export type CommentSource = "WEBHOOK" | "POLLING";

export interface ProcessCommentJob {
  instagramAccountId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  commenterName?: string;
  mediaId: string;
  requeueAttempt?: number;
  // Which path enqueued this comment. Available to the worker while it handles
  // the job, but not persisted after processing.
  source?: CommentSource;
  // When the polling reconciler sweeps an ad copy of a post, mediaId is the
  // ad's media id and originalMediaId is the post the campaign is bound to.
  // Without it the worker looks for a campaign on the ad id, finds none, and
  // drops the comment — so the sweep re-enqueues it every 5m and never delivers.
  originalMediaId?: string;
}

// Delivered when a user taps an opening DM's button — carries the reveal target.
export interface ProcessPostbackJob {
  instagramAccountId: string;
  userId: string;
  payload: string;
  mid?: string;
  fallback?: boolean;
}

// Scheduled after the link is delivered, to send the appreciation follow-up.
// Enqueued with a delay (followUpDelayMinutes) so it can fire later, not just
// immediately.
export interface ProcessFollowUpJob {
  instagramAccountId: string;
  userId: string;
  automationId: string;
  commenterName?: string | null;
}

// An inbound DM from a user. Campaigns with `dmTriggerEnabled` whose keywords
// match the text reply to the sender.
export interface ProcessMessageJob {
  instagramAccountId: string;
  messageId: string;
  messageText: string;
  senderId: string;
}

export type DmQueueJob =
  | ProcessCommentJob
  | ProcessPostbackJob
  | ProcessFollowUpJob
  | ProcessMessageJob;

export const POSTBACK_JOB_NAME = "process-postback";
export const FOLLOWUP_JOB_NAME = "process-followup";
export const MESSAGE_JOB_NAME = "process-message";

let dmQueue: Queue<DmQueueJob> | null = null;

export function getDMQueue(): Queue<DmQueueJob> {
  if (!dmQueue) {
    dmQueue = new Queue<DmQueueJob>("dm-processing", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
        // Clear failed jobs shortly after they exhaust retries. Job ids are
        // deterministic (comment_<acct>_<id>), so a retained failed job would
        // block the polling reconciler from ever retrying that comment. Clearing
        // them lets a later sweep re-enqueue and try again once a transient
        // failure (e.g. an Instagram rate-limit window) has passed. Failure
        // detail is still preserved in DmLog.
        removeOnFail: { age: 300, count: 2000 },
        attempts: 3,
        backoff: {
          type: "custom",
        },
      },
    });
  }
  return dmQueue;
}

/** Create a temporary Queue facade over a request-scoped Redis connection. */
export function getDMQueueForDiagnostics(
  redis: Redis,
): Queue<DmQueueJob> {
  return new Queue<DmQueueJob>("dm-processing", { connection: redis });
}
