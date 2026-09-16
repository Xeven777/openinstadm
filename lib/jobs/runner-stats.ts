/**
 * Runner (Trigger.dev) queue and run counters for the diagnostics page.
 *
 * Replaces `queue.getJobCounts()` from BullMQ. The runner API is the only
 * source that knows what is queued/running/delayed, since the web app no longer
 * holds a queue connection.
 *
 * Counts for delayed and recent failures come from listing runs, which is a
 * paged API with no aggregate endpoint — they are capped at `RUN_LIST_LIMIT` and
 * therefore reported as "at least" values on a busy account.
 */

import { queues, runs } from "@trigger.dev/sdk";
import { DM_QUEUE_NAME } from "./types";

const RUN_LIST_LIMIT = 100;
const FAILED_RUN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Run statuses that mean the job gave up, matching the old "failed" tile. */
const FAILED_STATUSES = [
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "TIMED_OUT",
  "EXPIRED",
] as const;

export interface RunnerQueueCounts {
  waiting: number | null;
  active: number | null;
  delayed: number | null;
  failed: number | null;
}

const DM_QUEUE = { type: "custom", name: DM_QUEUE_NAME } as const;

export async function getRunnerQueueCounts(): Promise<RunnerQueueCounts> {
  const [queue, delayed, failed] = await Promise.all([
    queues.retrieve(DM_QUEUE),
    runs.list({ queue: DM_QUEUE, status: ["DELAYED"], limit: RUN_LIST_LIMIT }),
    runs.list({
      queue: DM_QUEUE,
      status: [...FAILED_STATUSES],
      from: new Date(Date.now() - FAILED_RUN_WINDOW_MS),
      limit: RUN_LIST_LIMIT,
    }),
  ]);

  return {
    waiting: queue.queued ?? null,
    active: queue.running ?? null,
    delayed: delayed.data.length,
    failed: failed.data.length,
  };
}

/** True when the web app has credentials to talk to the runner API. */
export function isRunnerConfigured(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}
