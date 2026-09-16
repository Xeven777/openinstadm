/**
 * DM job payloads and identifiers.
 *
 * These types are shared by the producers (webhook route, polling reconciler,
 * the handlers themselves) and by the Trigger.dev tasks in `trigger/`. They
 * deliberately carry no queue-library types: the payload is the contract, the
 * runner is an implementation detail.
 */

export type CommentSource = "WEBHOOK" | "POLLING";

export interface ProcessCommentJob {
  instagramAccountId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  commenterName?: string;
  mediaId: string;
  requeueAttempt?: number;
  // Which path triggered this comment. Available to the handler while it
  // processes the job, but not persisted after processing.
  source?: CommentSource;
  // When the polling reconciler sweeps an ad copy of a post, mediaId is the
  // ad's media id and originalMediaId is the post the campaign is bound to.
  // Without it the handler looks for a campaign on the ad id, finds none, and
  // drops the comment — so the sweep re-enqueues it every pass and never
  // delivers.
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
// Triggered with a delay (followUpDelayMinutes) so it can fire later, not just
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

export type DmJob =
  | ProcessCommentJob
  | ProcessPostbackJob
  | ProcessFollowUpJob
  | ProcessMessageJob;

// Trigger.dev task ids. Equal to the BullMQ job names they replaced, so run
// history, dashboards, and log greps keep their meaning.
export const COMMENT_TASK_ID = "process-comment";
export const POSTBACK_TASK_ID = "process-postback";
export const FOLLOWUP_TASK_ID = "process-followup";
export const MESSAGE_TASK_ID = "process-message";
export const RECONCILE_TASK_ID = "reconcile-comments";

// The Trigger.dev queue every DM task runs on. Concurrency lives on the queue,
// not on a worker process, so a burst of comments can never spawn more than
// `DM_QUEUE_CONCURRENCY` concurrent Meta sends.
export const DM_QUEUE_NAME = "dm-processing";
export const DM_QUEUE_CONCURRENCY = 5;

// Retry policy for every DM task: three attempts at 5m → 15m → 45m. Replaces
// the BullMQ `attempts: 3` + custom backoff the worker used to configure, and
// keeps the same tolerance for transient Instagram rate-limit windows.
export const DM_TASK_RETRY = {
  maxAttempts: 3,
  factor: 3,
  minTimeoutInMs: 5 * 60_000,
  maxTimeoutInMs: 45 * 60_000,
  randomize: false,
} as const;

/**
 * Throw this when retrying a job cannot possibly help — an expired messaging
 * window, a missing access token, a dead encryption key.
 *
 * Handlers stay runner-agnostic: the Trigger.dev tasks translate this into
 * `AbortTaskRunError`, which stops retries. (It replaces BullMQ's
 * `UnrecoverableError`, which did the same job on the old worker.)
 */
export class PermanentJobFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobFailureError";
  }
}

/**
 * The job context handlers receive. BullMQ passed its own `Job` object; the
 * Trigger.dev tasks pass the equivalent fields so the handler logic stays
 * runner-agnostic.
 */
export interface JobContext<T> {
  data: T;
  id: string;
  // Attempts already made. 0 on the first run, matching BullMQ's semantics.
  attemptsMade: number;
}
