/**
 * DM pipeline tasks.
 *
 * Four jobs and one schedule, replacing the `worker/dm-worker.ts` entrypoint
 * and its BullMQ `Worker`. These are the only places that know about
 * Trigger.dev's run context; the business logic stays in
 * `lib/jobs/dm-handlers.ts`.
 *
 * Mapping from the old worker:
 *   - BullMQ `concurrency: 5`          → the `dm-processing` queue's limit
 *   - BullMQ `attempts: 3` + backoff   → `retry` (5m → 15m → 45m)
 *   - worker `setInterval` heartbeat   → `touchRunnerHeartbeat()` per run
 *   - worker `setTimeout` sweep        → the `reconcile-comments` schedule
 */

import os from "node:os";
import {
  AbortTaskRunError,
  schedules,
  task,
  type TaskRunContext,
} from "@trigger.dev/sdk";
import {
  processComment,
  processFollowUp,
  processMessage,
  processPostback,
  recordJobFailure,
} from "@/lib/jobs/dm-handlers";
import {
  COMMENT_TASK_ID,
  DM_QUEUE_CONCURRENCY,
  DM_QUEUE_NAME,
  DM_TASK_RETRY,
  FOLLOWUP_TASK_ID,
  MESSAGE_TASK_ID,
  PermanentJobFailureError,
  POSTBACK_TASK_ID,
  RECONCILE_TASK_ID,
  type ProcessCommentJob,
  type ProcessFollowUpJob,
  type ProcessMessageJob,
  type ProcessPostbackJob,
} from "@/lib/jobs/types";
import { recordWorkerHeartbeat } from "@/lib/ops/worker-health";
import { reconcileComments } from "@/lib/polling/comment-reconciler";

const RUNNER_STARTED_AT = new Date().toISOString();

/**
 * Refresh the runner heartbeat before doing any work.
 *
 * This used to be a 30s `setInterval` in the worker process. A serverless
 * runner has no process to observe, so the signal becomes "a DM job ran
 * recently" — written here on every run, including the hourly sweep, which is
 * what keeps it fresh during quiet periods.
 */
async function touchRunnerHeartbeat(ctx: TaskRunContext): Promise<void> {
  await recordWorkerHeartbeat({
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: RUNNER_STARTED_AT,
    taskId: ctx.task.id,
    runId: ctx.run.id,
  }).catch((error) => {
    // A missing heartbeat must never fail a DM send: health is an observation,
    // not a dependency.
    console.error(
      "[DM Worker] Heartbeat failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  });
}

/** Attempts already made, matching BullMQ's `attemptsMade` (0 on first run). */
function attemptsMade(ctx: TaskRunContext): number {
  return Math.max(0, ctx.attempt.number - 1);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Run a handler, translating the domain's "do not retry" error into the
 * runner's abort signal.
 *
 * The handlers throw `PermanentJobFailureError` for things a retry cannot fix
 * (an expired messaging window, a missing token). Trigger.dev retries anything
 * else, so without this a hopeless job would burn all three attempts — with
 * backoff windows up to 45 minutes — and mail an alert for each one.
 */
async function runHandler(handler: () => Promise<void>): Promise<void> {
  try {
    await handler();
  } catch (error) {
    if (error instanceof PermanentJobFailureError) {
      throw new AbortTaskRunError(error.message);
    }
    throw error;
  }
}

// Every DM task shares the queue (so a burst can never exceed five concurrent
// Meta sends) and the retry policy.
const DM_TASK_OPTIONS = {
  queue: { name: DM_QUEUE_NAME, concurrencyLimit: DM_QUEUE_CONCURRENCY },
  retry: DM_TASK_RETRY,
} as const;

export const processCommentTask = task({
  id: COMMENT_TASK_ID,
  ...DM_TASK_OPTIONS,
  run: async (payload: ProcessCommentJob, { ctx }) => {
    await touchRunnerHeartbeat(ctx);
    await runHandler(() =>
      processComment({
        data: payload,
        id: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
      })
    );
  },
  onFailure: async ({ payload, ctx, error }) => {
    await recordJobFailure(
      {
        taskId: COMMENT_TASK_ID,
        runId: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
        data: payload,
      },
      toError(error)
    );
  },
});

export const processPostbackTask = task({
  id: POSTBACK_TASK_ID,
  ...DM_TASK_OPTIONS,
  run: async (payload: ProcessPostbackJob, { ctx }) => {
    await touchRunnerHeartbeat(ctx);
    await runHandler(() =>
      processPostback({
        data: payload,
        id: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
      })
    );
  },
  onFailure: async ({ payload, ctx, error }) => {
    await recordJobFailure(
      {
        taskId: POSTBACK_TASK_ID,
        runId: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
        data: payload,
      },
      toError(error)
    );
  },
});

export const processFollowupTask = task({
  id: FOLLOWUP_TASK_ID,
  ...DM_TASK_OPTIONS,
  run: async (payload: ProcessFollowUpJob, { ctx }) => {
    await touchRunnerHeartbeat(ctx);
    await runHandler(() =>
      processFollowUp({
        data: payload,
        id: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
      })
    );
  },
  onFailure: async ({ payload, ctx, error }) => {
    await recordJobFailure(
      {
        taskId: FOLLOWUP_TASK_ID,
        runId: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
        data: payload,
      },
      toError(error)
    );
  },
});

export const processMessageTask = task({
  id: MESSAGE_TASK_ID,
  ...DM_TASK_OPTIONS,
  run: async (payload: ProcessMessageJob, { ctx }) => {
    await touchRunnerHeartbeat(ctx);
    await runHandler(() =>
      processMessage({
        data: payload,
        id: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
      })
    );
  },
  onFailure: async ({ payload, ctx, error }) => {
    await recordJobFailure(
      {
        taskId: MESSAGE_TASK_ID,
        runId: ctx.run.id,
        attemptsMade: attemptsMade(ctx),
        data: payload,
      },
      toError(error)
    );
  },
});

/**
 * Polling safety net for comments Instagram never delivers over webhooks.
 *
 * Hourly, not every minute: Neon's pooled compute needs a query-free window to
 * autosuspend, and an hourly sweep leaves ~55 minutes of idle time in between.
 * Vercel's Hobby crons could not express this (once per day), which is why the
 * old worker owned the interval — now the runner's schedule does.
 */
export const reconcileCommentsTask = schedules.task({
  id: RECONCILE_TASK_ID,
  cron: "0 * * * *",
  run: async (_payload, { ctx }) => {
    await touchRunnerHeartbeat(ctx);
    await reconcileComments();
  },
});
