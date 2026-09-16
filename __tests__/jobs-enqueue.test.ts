import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTrigger, mockBatchTrigger } = vi.hoisted(() => ({
  mockTrigger: vi.fn(),
  mockBatchTrigger: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger: mockTrigger,
    batchTrigger: mockBatchTrigger,
  },
}));

import { enqueueCommentJob, enqueueDMJobs } from "../lib/jobs/enqueue";

const comment = {
  instagramAccountId: "ig_456",
  commentId: "comment_555",
  commentText: "LINK",
  commenterId: "commenter_999",
  mediaId: "media_101",
};

const postback = {
  instagramAccountId: "ig_456",
  userId: "commenter_999",
  payload: "reveal:auto_789",
};

describe("enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends milliseconds as a whole-second delay string", async () => {
    await enqueueCommentJob(comment, {
      delayMs: 1_800_000,
      idempotencyKey: "comment_ig_456_comment_555_retry_1",
    });

    expect(mockTrigger).toHaveBeenCalledWith("process-comment", comment, {
      delay: "1800s",
      idempotencyKey: "comment_ig_456_comment_555_retry_1",
    });
  });

  it("omits runner options entirely when none are given", async () => {
    await enqueueCommentJob(comment);

    expect(mockTrigger).toHaveBeenCalledWith("process-comment", comment, undefined);
  });

  it("never schedules a zero-second delay, which the runner rejects", async () => {
    await enqueueCommentJob(comment, { delayMs: 0 });

    expect(mockTrigger).toHaveBeenCalledWith("process-comment", comment, {
      delay: "1s",
    });
  });

  it("groups a mixed batch into one call per task", async () => {
    await enqueueDMJobs([
      { task: "process-comment", data: comment, options: { idempotencyKey: "c1" } },
      { task: "process-postback", data: postback },
      {
        task: "process-comment",
        data: { ...comment, commentId: "comment_556" },
      },
    ]);

    expect(mockBatchTrigger).toHaveBeenCalledTimes(2);

    const commentBatch = mockBatchTrigger.mock.calls.find(
      ([task]) => task === "process-comment"
    );
    const postbackBatch = mockBatchTrigger.mock.calls.find(
      ([task]) => task === "process-postback"
    );

    expect(commentBatch?.[1]).toEqual([
      { payload: comment, options: { idempotencyKey: "c1" } },
      { payload: { ...comment, commentId: "comment_556" }, options: undefined },
    ]);
    expect(postbackBatch?.[1]).toEqual([{ payload: postback, options: undefined }]);
  });

  it("does not call the runner for an empty batch", async () => {
    await enqueueDMJobs([]);

    expect(mockBatchTrigger).not.toHaveBeenCalled();
    expect(mockTrigger).not.toHaveBeenCalled();
  });
});
