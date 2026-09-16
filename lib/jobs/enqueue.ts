/**
 * Job producer for the DM pipeline.
 *
 * This is the only place that talks to the job runner. Webhook routes,
 * cron routes, and the handlers themselves call these helpers; nothing else
 * needs to know that Trigger.dev is behind them.
 *
 * Replaces the BullMQ `Queue` facade. The two mapping details that matter:
 *   - BullMQ `delay` (ms) → Trigger.dev `delay` (a duration string, here always
 *     expressed in whole seconds).
 *   - BullMQ `jobId` (dedupe while the job record exists) → Trigger.dev
 *     `idempotencyKey` (dedupe for `idempotencyKeyTTL`, 30 days by default).
 */

import { tasks } from "@trigger.dev/sdk";
import type {
  processCommentTask,
  processPostbackTask,
  processFollowupTask,
  processMessageTask,
} from "@/trigger/dm-processing";
import {
  COMMENT_TASK_ID,
  FOLLOWUP_TASK_ID,
  MESSAGE_TASK_ID,
  POSTBACK_TASK_ID,
  type ProcessCommentJob,
  type ProcessFollowUpJob,
  type ProcessMessageJob,
  type ProcessPostbackJob,
} from "./types";

export interface EnqueueOptions {
  /** Delay before the run starts. */
  delayMs?: number;
  /** Stable key: a repeat trigger with the same key returns the existing run. */
  idempotencyKey?: string;
  /** How long the idempotency key is remembered. Defaults to 30 days. */
  idempotencyKeyTTL?: string;
}

type RunOptions = {
  delay?: string;
  idempotencyKey?: string;
  idempotencyKeyTTL?: string;
};

function toRunOptions(options: EnqueueOptions | undefined): RunOptions | undefined {
  if (!options) return undefined;

  const runOptions: RunOptions = {};
  if (typeof options.delayMs === "number") {
    // Trigger.dev takes a duration string or a Date, not milliseconds. Whole
    // seconds is the finest unit any caller uses (bursts are minutes apart).
    runOptions.delay = `${Math.max(1, Math.round(options.delayMs / 1000))}s`;
  }
  if (options.idempotencyKey) {
    runOptions.idempotencyKey = options.idempotencyKey;
  }
  if (options.idempotencyKeyTTL) {
    runOptions.idempotencyKeyTTL = options.idempotencyKeyTTL;
  }

  return Object.keys(runOptions).length > 0 ? runOptions : undefined;
}

/** A DM job to trigger, discriminated by the task it belongs to. */
export type DmJobRequest =
  | { task: typeof COMMENT_TASK_ID; data: ProcessCommentJob; options?: EnqueueOptions }
  | { task: typeof POSTBACK_TASK_ID; data: ProcessPostbackJob; options?: EnqueueOptions }
  | { task: typeof FOLLOWUP_TASK_ID; data: ProcessFollowUpJob; options?: EnqueueOptions }
  | { task: typeof MESSAGE_TASK_ID; data: ProcessMessageJob; options?: EnqueueOptions };

export async function enqueueCommentJob(
  data: ProcessCommentJob,
  options?: EnqueueOptions
): Promise<void> {
  await tasks.trigger<typeof processCommentTask>(
    COMMENT_TASK_ID,
    data,
    toRunOptions(options)
  );
}

export async function enqueuePostbackJob(
  data: ProcessPostbackJob,
  options?: EnqueueOptions
): Promise<void> {
  await tasks.trigger<typeof processPostbackTask>(
    POSTBACK_TASK_ID,
    data,
    toRunOptions(options)
  );
}

export async function enqueueFollowUpJob(
  data: ProcessFollowUpJob,
  options?: EnqueueOptions
): Promise<void> {
  await tasks.trigger<typeof processFollowupTask>(
    FOLLOWUP_TASK_ID,
    data,
    toRunOptions(options)
  );
}

export async function enqueueMessageJob(
  data: ProcessMessageJob,
  options?: EnqueueOptions
): Promise<void> {
  await tasks.trigger<typeof processMessageTask>(
    MESSAGE_TASK_ID,
    data,
    toRunOptions(options)
  );
}

/**
 * Trigger a mixed batch of DM jobs.
 *
 * `tasks.batchTrigger` is per-task, so this groups by task id and issues one
 * batch call per task type. A webhook payload typically contains one or two
 * event types, so that is at most a couple of round trips — much cheaper than
 * triggering each event separately, which is what the webhook used to do
 * against Redis.
 */
export async function enqueueDMJobs(jobs: DmJobRequest[]): Promise<void> {
  if (jobs.length === 0) return;

  const byTask = new Map<string, { payload: unknown; options?: RunOptions }[]>();
  for (const job of jobs) {
    const items = byTask.get(job.task) ?? [];
    items.push({ payload: job.data, options: toRunOptions(job.options) });
    byTask.set(job.task, items);
  }

  await Promise.all(
    [...byTask.entries()].map(([task, items]) => {
      switch (task) {
        case COMMENT_TASK_ID:
          return tasks.batchTrigger<typeof processCommentTask>(
            COMMENT_TASK_ID,
            items as { payload: ProcessCommentJob; options?: RunOptions }[]
          );
        case POSTBACK_TASK_ID:
          return tasks.batchTrigger<typeof processPostbackTask>(
            POSTBACK_TASK_ID,
            items as { payload: ProcessPostbackJob; options?: RunOptions }[]
          );
        case FOLLOWUP_TASK_ID:
          return tasks.batchTrigger<typeof processFollowupTask>(
            FOLLOWUP_TASK_ID,
            items as { payload: ProcessFollowUpJob; options?: RunOptions }[]
          );
        default:
          return tasks.batchTrigger<typeof processMessageTask>(
            MESSAGE_TASK_ID,
            items as { payload: ProcessMessageJob; options?: RunOptions }[]
          );
      }
    })
  );
}

/**
 * Send a single job request, whichever task it belongs to.
 */
export async function enqueueDMJob(job: DmJobRequest): Promise<void> {
  switch (job.task) {
    case COMMENT_TASK_ID:
      return enqueueCommentJob(job.data, job.options);
    case POSTBACK_TASK_ID:
      return enqueuePostbackJob(job.data, job.options);
    case FOLLOWUP_TASK_ID:
      return enqueueFollowUpJob(job.data, job.options);
    case MESSAGE_TASK_ID:
      return enqueueMessageJob(job.data, job.options);
  }
}
