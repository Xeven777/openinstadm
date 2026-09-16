import {
  COMMENT_TASK_ID,
  PermanentJobFailureError,
  type JobContext,
  type ProcessCommentJob,
  type ProcessFollowUpJob,
  type ProcessMessageJob,
  type ProcessPostbackJob,
} from "./types";
import { enqueueDMJob, enqueueFollowUpJob } from "./enqueue";
import { prisma } from "@/lib/db/client";
import {
  MetaApiError,
  MessagingWindowClosedError,
  PermissionError,
  RateLimitError,
  TokenExpiredError,
  getUserFollowStatus,
  sendCommentReply,
  sendDirectMessage,
  sendDirectMessageWithButton,
  sendDirectMessageWithLinkButton,
  sendPrivateReply,
  sendPrivateReplyWithButton,
  sendPrivateReplyWithLinkButton,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { reserveDMSlot } from "@/lib/utils/rate-limiter";
import {
  releaseWorkspaceDMReservation,
  reserveWorkspaceDMSend,
} from "@/lib/billing/usage";
import {
  buildTrackedUrl,
  renderMessageWithTracking,
  renderMessageWithoutLink,
} from "@/lib/tracking/message";
import { generateReply } from "@/lib/ai/client";
import { checkAiBudget, consumeAiBudget } from "@/lib/ai/budget";
import { getAIModel, isAIEnabled } from "@/lib/env";
import { hasOpenMessagingWindow } from "@/lib/meta/messaging-window";

function formatError(error: unknown): string {
  if (error instanceof MetaApiError) {
    return `Meta API Error ${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

// Meta rejections that a plain-text retry cannot fix: the send was refused for
// the conversation, not for the button template. Retrying as text just burns
// the attempt and — worse — overwrites the real error with a misleading one
// ("invalid for a private reply", because the first attempt already used up the
// comment's single allowed private reply).
const NON_TEMPLATE_REJECTIONS = [
  /outside of allowed window/i,
  /invalid for a private reply/i,
  /requested user cannot be found/i,
];

function isTemplateRejection(error: unknown): boolean {
  if (error instanceof TokenExpiredError || error instanceof RateLimitError) {
    return false;
  }
  const message = error instanceof Error ? error.message : "";
  return !NON_TEMPLATE_REJECTIONS.some((pattern) => pattern.test(message));
}

type WorkerTrackedLink = {
  slug: string;
  label: string | null;
  destinationUrl: string;
};

/**
 * Build the tappable link buttons for a DM. The first link uses the campaign's
 * `linkButtonLabel`; each additional link uses its own stored `label`. Capped at
 * Meta's 3-button limit for a button template.
 */
function buildLinkButtons(
  trackedLinks: WorkerTrackedLink[],
  primaryLabel: string | null
): { title: string; url: string }[] {
  return trackedLinks.slice(0, 3).map((link, index) => ({
    url: buildTrackedUrl(link.slug),
    title: (index === 0 ? primaryLabel : link.label) || link.label || "Open link",
  }));
}

/**
 * Fallback text when Meta rejects the button template: render the primary link
 * inline, then append any extra tracked URLs on their own lines so no link is
 * lost.
 */
function buildInlineLinkFallback(
  message: string,
  commenterName: string | null | undefined,
  trackedLinks: WorkerTrackedLink[],
  bodyText: string
): string {
  const base =
    renderMessageWithTracking({ message, commenterName, trackedLinks }) ||
    bodyText;
  const extraUrls = trackedLinks.slice(1).map((link) => buildTrackedUrl(link.slug));
  return extraUrls.length > 0 ? `${base}\n${extraUrls.join("\n")}` : base;
}

type RevealAutomation = {
  dmMessage: string;
  linkButtonLabel: string | null;
  trackedLinks: WorkerTrackedLink[];
  instagramAccount: { instagramId: string };
};

/**
 * Deliver a campaign's reveal message as a direct message. Shared by the
 * button-tap (postback) path and the DM keyword-trigger path — both already
 * have an open conversation with the user, so neither uses a private reply.
 */
async function sendRevealDirectMessage(
  accessToken: string,
  automation: RevealAutomation,
  userId: string,
  commenterName: string | null,
  context: string
): Promise<void> {
  if (automation.trackedLinks.length === 0) {
    await sendDirectMessage(
      accessToken,
      automation.instagramAccount.instagramId,
      userId,
      renderMessageWithTracking({
        message: automation.dmMessage,
        commenterName,
        trackedLinks: automation.trackedLinks,
      })
    );
    return;
  }

  // Try button template first; if Meta rejects it, fall back to inline links.
  const bodyText =
    renderMessageWithoutLink({
      message: automation.dmMessage,
      commenterName,
    }) || "Here's your link:";
  const buttons = buildLinkButtons(
    automation.trackedLinks,
    automation.linkButtonLabel
  );

  try {
    await sendDirectMessageWithLinkButton(
      accessToken,
      automation.instagramAccount.instagramId,
      userId,
      bodyText,
      buttons
    );
  } catch (buttonError) {
    // A closed messaging window rejects the text retry too, so don't let it
    // overwrite the original error with a misleading one.
    if (!isTemplateRejection(buttonError)) throw buttonError;

    console.log(
      `[DM Worker] Button template rejected in ${context}, falling back to inline link:`,
      formatError(buttonError)
    );
    try {
      await sendDirectMessage(
        accessToken,
        automation.instagramAccount.instagramId,
        userId,
        buildInlineLinkFallback(
          automation.dmMessage,
          commenterName,
          automation.trackedLinks,
          bodyText
        )
      );
    } catch {
      throw buttonError;
    }
  }
}

export async function processComment(
  job: JobContext<ProcessCommentJob>
): Promise<void> {
  console.log(`[DM Worker] === processComment JOB START ===`);
  console.log(`[DM Worker] Job ID: ${job.id}`);
  console.log(`[DM Worker] Attempt: ${job.attemptsMade}`);
  const {
    instagramAccountId,
    commentId,
    commentText,
    commenterId,
    commenterName,
    mediaId,
    originalMediaId,
  } = job.data;
  
  console.log(`[DM Worker] Comment event: account=${instagramAccountId}, commentId=${commentId}, commenterId=${commenterId}, text="${commentText.slice(0, 100)}"`);
  const requeueAttempt = job.data.requeueAttempt ?? 0;

  const automations = await prisma.automation.findMany({
    where: {
      // Match campaigns bound to this specific post, plus any-post campaigns.
      // When the polling reconciler sweeps an ad copy, mediaId is the ad's id
      // and originalMediaId is the post the campaign is bound to. Without the
      // second clause the worker finds no campaign and drops the comment, so
      // the sweep re-enqueues it every 5m and never delivers (DmLog stays empty).
      OR: [
        { postId: mediaId },
        ...(originalMediaId ? [{ postId: originalMediaId } as const] : []),
        { matchAnyPost: true },
      ],
      isActive: true,
      instagramAccount: {
        instagramId: instagramAccountId,
      },
    },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: {
          slug: true,
          label: true,
          destinationUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const automation of automations) {
    // "Any word" campaigns fire on every comment; otherwise require a keyword hit.
    const matchResult = automation.matchAnyWord
      ? { matched: true, matchedKeyword: null }
      : matchKeywords(
          commentText,
          automation.keywords,
          automation.wholeWordMatch
        );

    if (!matchResult.matched) {
      continue;
    }

    if (!automation.instagramAccount.accessToken) {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        create: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
        update: {
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
      });
      continue;
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(automation.instagramAccount.accessToken);
    } catch {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        create: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "FAILED",
          errorMessage: "Failed to decrypt Instagram access token",
        },
        update: {
          status: "FAILED",
          errorMessage: "Failed to decrypt Instagram access token",
        },
      });
      continue;
    }

    // Atomic reservation with advisory lock. Two workers can both read
    // "no sent log yet" and both attempt a private reply; the DB unique key
    // on (automationId, commentId) protects the row creation, but the
    // cross-campaign "one private reply per comment" check and the SENT
    // check must be atomic with the PENDING claim — otherwise both pass
    // the read, both call Meta, and one burns the single allowed reply.
    let txResult: {
      action: "proceed" | "publicOnly" | "dedup" | "skip";
      existingLog: { status: string; publicReplySentAt: Date | null } | null;
    } | null = null;
    try {
      txResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${commentId}))`;

        const dbExisting = await tx.dmLog.findUnique({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          select: { status: true, publicReplySentAt: true },
        });

        if (dbExisting?.status === "SKIPPED_PLAN_LIMIT") {
          return { action: "skip" as const, existingLog: dbExisting as typeof dbExisting };
        }
        if (dbExisting?.status === "PENDING") {
          return { action: "skip" as const, existingLog: dbExisting as typeof dbExisting };
        }
        const alreadyDmd = dbExisting?.status === "SENT";
        const alreadyPublicReplied = Boolean(dbExisting?.publicReplySentAt);
        const needsDmLocal = !alreadyDmd;
        if (alreadyDmd && (alreadyPublicReplied || !automation.publicReplyEnabled)) {
          return { action: "skip" as const, existingLog: dbExisting as typeof dbExisting };
        }
        if (!needsDmLocal) {
          return { action: "publicOnly" as const, existingLog: dbExisting as typeof dbExisting };
        }

        const privateReplyUsedBy = await tx.dmLog.findFirst({
          where: {
            commentId,
            status: { in: ["SENT", "PENDING"] },
            automationId: { not: automation.id },
          },
          select: { automation: { select: { name: true } } },
        });
        if (privateReplyUsedBy) {
          const dedupName = privateReplyUsedBy.automation?.name ?? "unknown";
          if (!dbExisting) {
            await tx.dmLog.create({
              data: {
                workspaceId: automation.workspaceId,
                automationId: automation.id,
                instagramAccountId: automation.instagramAccountId,
                commenterId,
                commenterName,
                commentText,
                commentId,
                matchedKeyword: matchResult.matchedKeyword,
                status: "SKIPPED_DEDUP",
                errorMessage: `Another campaign (${dedupName}) already sent the one private reply Instagram allows for this comment`,
              },
            });
          } else {
            await tx.dmLog.update({
              where: {
                automationId_commentId: { automationId: automation.id, commentId },
              },
              data: {
                status: "SKIPPED_DEDUP",
                matchedKeyword: matchResult.matchedKeyword,
                errorMessage: `Another campaign (${dedupName}) already sent the one private reply Instagram allows for this comment`,
              },
            });
          }
          return { action: "dedup" as const, existingLog: dbExisting as typeof dbExisting };
        }

        if (!dbExisting) {
          await tx.dmLog.create({
            data: {
              workspaceId: automation.workspaceId,
              automationId: automation.id,
              instagramAccountId: automation.instagramAccountId,
              commenterId,
              commenterName,
              commentText,
              commentId,
              matchedKeyword: matchResult.matchedKeyword,
              status: "PENDING",
              attempts: job.attemptsMade + 1,
            },
          });
        } else {
          await tx.dmLog.update({
            where: {
              automationId_commentId: { automationId: automation.id, commentId },
            },
            data: {
              status: "PENDING",
              attempts: job.attemptsMade + 1,
              matchedKeyword: matchResult.matchedKeyword,
              errorMessage: null,
            },
          });
        }
        return { action: "proceed" as const, existingLog: dbExisting as typeof dbExisting };
      });
    } catch (error) {
      // Unique violation (P2002) means a concurrent worker won the claim.
      // Treat it as a dedup skip — the winner will send the DM.
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        continue;
      }
      throw error;
    }

    const existingLog = txResult?.existingLog ?? null;
    const reservationAction = txResult?.action ?? "skip";
    if (reservationAction === "skip") continue;

    // Public reply leg — decoupled from the DM and posted first so a DM failure
    // (e.g. a non-follower whose messaging is restricted) never suppresses it.
    // Idempotent across retries via publicReplySentAt. For the atomic path we
    // use the snapshot captured inside the lock; it reflects the row before we
    // claimed PENDING, so a concurrent duplicate that also claimed will still
    // have its own row and will be skipped above.
    const replyPool =
      automation.publicReplyMessages.length > 0
        ? automation.publicReplyMessages
        : automation.publicReplyMessage
          ? [automation.publicReplyMessage]
          : [];
    if (
      automation.publicReplyEnabled &&
      replyPool.length > 0 &&
      !existingLog?.publicReplySentAt
    ) {
      try {
        const chosen = replyPool[Math.floor(Math.random() * replyPool.length)];
        const publicReply = renderMessageWithTracking({
          message: chosen,
          commenterName,
          trackedLinks: automation.trackedLinks,
        });
        await sendCommentReply(accessToken, commentId, publicReply);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: { publicReplySentAt: new Date(), publicReplyError: null },
        });
      } catch (error) {
        console.error(
          "[DM Worker] Public comment reply failed:",
          formatError(error)
        );
        await prisma.dmLog
          .update({
            where: {
              automationId_commentId: { automationId: automation.id, commentId },
            },
            data: { publicReplyError: formatError(error) },
          })
          .catch(() => {});
      }
    }

    // DM already sent on an earlier pass, or the slot was taken by another
    // campaign while we held the lock; the public reply retry above was all
    // this run needed.
    if (reservationAction !== "proceed") continue;

    const usage = await reserveWorkspaceDMSend(automation.workspaceId);
    if (!usage.allowed) {
      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "SKIPPED_PLAN_LIMIT",
          matchedKeyword: matchResult.matchedKeyword,
          errorMessage: `Monthly DM limit reached (${usage.limit})`,
        },
      });
      continue;
    }

    let rateLimit;
    try {
      rateLimit = await reserveDMSlot(instagramAccountId, requeueAttempt);
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );
      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "FAILED",
          attempts: job.attemptsMade + 1,
          errorMessage: formatError(error),
        },
      });
      throw error;
    }

    if (!rateLimit.allowed) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );

      if (rateLimit.shouldSkip) {
        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "SKIPPED_RATE_LIMIT",
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: "Hourly Instagram DM rate limit reached",
          },
        });
        continue;
      }

      if (rateLimit.shouldRequeue) {
        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "PENDING",
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: "Hourly rate limit hit; retry scheduled",
          },
        });

        await enqueueDMJob({
          task: COMMENT_TASK_ID,
          data: {
            ...job.data,
            requeueAttempt: requeueAttempt + 1,
          },
          options: {
            delayMs: rateLimit.requeueDelayMs,
            idempotencyKey: `comment_${instagramAccountId}_${commentId}_retry_${requeueAttempt + 1}`,
          },
        });
        continue;
      }
    }

    // With an opening DM, the private reply is a button message; tapping it
    // fires a postback that delivers the reveal (see processPostback). Without
    // one, we send the reveal text directly as today.
    const useOpeningDm =
      automation.openingDmEnabled &&
      Boolean(automation.openingDmMessage?.trim()) &&
      Boolean(automation.openingDmButtonLabel?.trim());

    // Follow-gating: the link is revealed only after a follow. When an opening
    // DM is enabled it comes FIRST, and its button routes into the follow check
    // (opening DM → follow gate → link). Without an opening DM, we check follow
    // status at comment time: confirmed followers get the link now, everyone
    // else gets the "follow me first" prompt (re-verified on tap).
    let sendFollowPrompt = false;
    if (automation.requireFollow && !useOpeningDm) {
      const alreadyFollows = await getUserFollowStatus(accessToken, commenterId);
      sendFollowPrompt = alreadyFollows !== true;
    }

    try {
      if (useOpeningDm) {
        const openingText =
          renderMessageWithoutLink({
            message: automation.openingDmMessage as string,
            commenterName,
          }) || "Tap the button below to get your link:";
        const openingPayload = automation.requireFollow
          ? `followcheck:${automation.id}`
          : `reveal:${automation.id}`;
        const openingButtonLabel = automation.openingDmButtonLabel as string;
        try {
          await sendPrivateReplyWithButton(
            accessToken,
            automation.instagramAccount.instagramId,
            commentId,
            openingText,
            openingButtonLabel,
            openingPayload
          );
        } catch (buttonError) {
          if (!isTemplateRejection(buttonError)) throw buttonError;
          console.log(
            "[DM Worker] Opening button template rejected, falling back to plain text:",
            formatError(buttonError)
          );
          try {
            await sendPrivateReply(
              accessToken,
              automation.instagramAccount.instagramId,
              commentId,
              openingText
            );
          } catch {
            throw buttonError;
          }
        }
      } else if (sendFollowPrompt) {
        const promptText = renderMessageWithoutLink({
          message:
            automation.followPromptMessage ||
            "quick favor before i send your link. i don't make any money from this, it's free. if you want to support me, just don't unfollow after, and star the repo on github if it helps you. tap the button once you're following and i'll send it over",
          commenterName,
        });
        await sendPrivateReplyWithButton(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          promptText,
          automation.followPromptButtonLabel || "i'm following",
          `followcheck:${automation.id}`
        );
      } else if (automation.trackedLinks.length > 0) {
        // Try button template first; if Meta rejects it, fall back to inline links.
        const bodyText =
          renderMessageWithoutLink({
            message: automation.dmMessage,
            commenterName,
          }) || "Here's your link:";
        const buttons = buildLinkButtons(
          automation.trackedLinks,
          automation.linkButtonLabel
        );

        try {
          await sendPrivateReplyWithLinkButton(
            accessToken,
            automation.instagramAccount.instagramId,
            commentId,
            bodyText,
            buttons
          );
        } catch (buttonError) {
          // Only a template rejection is worth retrying as text. Anything else
          // (closed window, comment already replied to) fails the same way and
          // would replace the real error with a misleading one.
          if (!isTemplateRejection(buttonError)) throw buttonError;

          console.log(
            "[DM Worker] Button template rejected, falling back to inline link:",
            formatError(buttonError)
          );
          const fallbackMessage = buildInlineLinkFallback(
            automation.dmMessage,
            commenterName,
            automation.trackedLinks,
            bodyText
          );
          try {
            await sendPrivateReply(
              accessToken,
              automation.instagramAccount.instagramId,
              commentId,
              fallbackMessage
            );
          } catch {
            // The first attempt consumed the comment's single private reply, so
            // this one reports "invalid for a private reply" no matter what the
            // underlying problem was. Surface the original rejection instead.
            throw buttonError;
          }
        }
      } else {
        const dmMessage = renderMessageWithTracking({
          message: automation.dmMessage,
          commenterName,
          trackedLinks: automation.trackedLinks,
        });
        await sendPrivateReply(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          dmMessage
        );
      }

      // Direct link was delivered (no opening DM, no follow prompt) — schedule
      // the appreciation follow-up now if enabled. The opening DM path's
      // follow-up is scheduled in processPostback after the button tap, so we
      // must not schedule here for that path or we'd send it before the link.
      const directLinkDelivered = !useOpeningDm && !sendFollowPrompt;
      if (
        directLinkDelivered &&
        automation.followUpEnabled &&
        automation.followUpMessage?.trim()
      ) {
        const delayMs =
          Math.max(0, automation.followUpDelayMinutes ?? 0) * 60_000;
        await enqueueFollowUpJob(
          {
            instagramAccountId: automation.instagramAccount.instagramId,
            userId: commenterId,
            automationId: automation.id,
            commenterName,
          },
          {
            delayMs,
            idempotencyKey: `followup_${automation.id}_${commenterId}`,
          }
        );
      }

      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "SENT",
          dmSentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );

      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "FAILED",
          attempts: job.attemptsMade + 1,
          errorMessage: formatError(error),
        },
      });
      throw error;
    }
  }
}

/**
 * Deliver the reveal message after a user taps an opening DM's button.
 * The postback payload is `reveal:<automationId>`; the sender is the user's
 * IGSID (same id as their comment author id), which we DM directly.
 */
export async function processPostback(
  job: JobContext<ProcessPostbackJob>
): Promise<void> {
  const { instagramAccountId, userId, payload, fallback } = job.data;

  const isFollowCheck = payload.startsWith("followcheck:");
  if (!isFollowCheck && !payload.startsWith("reveal:")) return;
  const automationId = payload.slice(
    isFollowCheck ? "followcheck:".length : "reveal:".length
  );

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, isActive: true },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: { slug: true, label: true, destinationUrl: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (
    !automation ||
    automation.instagramAccount.instagramId !== instagramAccountId ||
    !automation.instagramAccount.accessToken
  ) {
    return;
  }

  // Duplicate sends are enabled: every button tap re-sends the reveal
  // instead of only firing once per person.
  const dedupeId = `reveal:${userId}`;

  if (fallback) {
    const existingReveal = await prisma.dmLog.findUnique({
      where: {
        automationId_commentId: {
          automationId: automation.id,
          commentId: dedupeId,
        },
      },
    });
    if (existingReveal?.status === "SENT") return;
  }

  // Personalize {username} from the opening DM log for this user, if present.
  const openingLog = await prisma.dmLog.findFirst({
    where: { automationId: automation.id, commenterId: userId },
    select: { commenterName: true },
  });
  const commenterName = openingLog?.commenterName ?? null;

  let accessToken: string;
  try {
    accessToken = decryptToken(automation.instagramAccount.accessToken);
  } catch {
    return;
  }

  // Follow-gate: before revealing the link, verify the user follows. On a
  // `followcheck:` tap a non-follower gets the prompt again (no quota spent);
  // on a read fallback a non-follower is silently skipped — the gate must not
  // be bypassable by just reading the DM and waiting. Following, or
  // unverifiable (null), falls through and delivers the link — fail-open so a
  // real follower is never trapped.
  if ((isFollowCheck || fallback) && automation.requireFollow) {
    const follows = await getUserFollowStatus(accessToken, userId);
    if (follows === false) {
      if (fallback) return;
      const promptText = renderMessageWithoutLink({
        message:
          automation.followPromptMessage ||
          "quick favor before i send your link. i don't make any money from this, it's free. if you want to support me, just don't unfollow after, and star the repo on github if it helps you. tap the button once you're following and i'll send it over",
        commenterName,
      });
      try {
        await sendDirectMessageWithButton(
          accessToken,
          automation.instagramAccount.instagramId,
          userId,
          promptText,
          automation.followPromptButtonLabel || "i'm following",
          `followcheck:${automation.id}`
        );
      } catch (error) {
        console.log(
          "[DM Worker] Failed to re-send follow prompt:",
          formatError(error)
        );
      }
      return;
    }
  }

  const usage = await reserveWorkspaceDMSend(automation.workspaceId);
  if (!usage.allowed) {
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "SKIPPED_PLAN_LIMIT",
        errorMessage: `Monthly DM limit reached (${usage.limit})`,
      },
      update: { status: "SKIPPED_PLAN_LIMIT" },
    });
    return;
  }

  try {
    await sendRevealDirectMessage(
      accessToken,
      automation,
      userId,
      commenterName,
      "postback"
    );
    // Optional appreciation follow-up: once the link has been delivered, send a
    // short thank-you. It is scheduled as its own delayed job so it can go out
    // some minutes later (followUpDelayMinutes) rather than immediately. The
    // deterministic job id dedupes repeat button taps to one follow-up per user.
    if (automation.followUpEnabled && automation.followUpMessage?.trim()) {
      const delayMs =
        Math.max(0, automation.followUpDelayMinutes ?? 0) * 60_000;
      await enqueueFollowUpJob(
        {
          instagramAccountId: automation.instagramAccount.instagramId,
          userId,
          automationId: automation.id,
          commenterName,
        },
        {
          delayMs,
          idempotencyKey: `followup_${automation.id}_${userId}`,
        }
      );
    }
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "SENT",
        dmSentAt: new Date(),
      },
      update: { status: "SENT", dmSentAt: new Date(), errorMessage: null },
    });
  } catch (error) {
    await releaseWorkspaceDMReservation(automation.workspaceId, usage.periodStart);

    // The read fallback is speculative: it only runs when the user read the
    // opening DM and never tapped the button, which means they never messaged
    // us, which means the 24-hour window is closed and Meta rejects the send
    // ("outside of allowed window"). That is the expected outcome here, not a
    // failure the user can act on — so don't log it as FAILED and don't retry
    // it against a window that cannot reopen on its own. It still delivers in
    // the case that does work: the user replied by typing instead of tapping.
    if (fallback) {
      console.log(
        "[DM Worker] Read fallback not delivered (messaging window closed):",
        formatError(error)
      );
      return;
    }

    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "FAILED",
        errorMessage: formatError(error),
      },
      update: { status: "FAILED", errorMessage: formatError(error) },
    });
    throw error;
  }
}

/**
 * Send the scheduled appreciation follow-up. Runs after its delay elapses.
 * Persist delivery outcomes. Transient errors use the runner's bounded retries;
 * permanent errors remain failed and visible without futile retries.
 */
export async function processFollowUp(
  job: JobContext<ProcessFollowUpJob>
): Promise<void> {
  const { instagramAccountId, userId, automationId, commenterName } = job.data;

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, isActive: true },
    include: { instagramAccount: true },
  });

  if (
    !automation ||
    !automation.followUpEnabled ||
    !automation.followUpMessage?.trim() ||
    automation.instagramAccount.instagramId !== instagramAccountId
  ) {
    return;
  }

  const commentId = `followup:${job.id ?? `${automationId}_${userId}`}`;
  const where = { automationId_commentId: { automationId, commentId } };
  const existing = await prisma.dmLog.findUnique({ where });
  if (existing?.status === "SENT") return;

  await prisma.dmLog.upsert({
    where,
    create: {
      workspaceId: automation.workspaceId,
      automationId,
      instagramAccountId: automation.instagramAccountId,
      commenterId: userId,
      commenterName,
      commentText: "(follow-up)",
      commentId,
      status: "PENDING",
      attempts: job.attemptsMade + 1,
    },
    update: { status: "PENDING", attempts: job.attemptsMade + 1, errorMessage: null },
  });

  try {
    if (!automation.instagramAccount.accessToken) {
      throw new PermanentJobFailureError(
        "Instagram account has no access token; reconnect the account"
      );
    }
    let accessToken: string;
    try {
      accessToken = decryptToken(automation.instagramAccount.accessToken);
    } catch {
      throw new PermanentJobFailureError(
        "Failed to decrypt Instagram access token; check the job runner's encryption key"
      );
    }
    if (!(await hasOpenMessagingWindow(instagramAccountId, userId))) {
      throw new PermanentJobFailureError(
        "Follow-up not sent: no verified user response within Instagram's 24-hour messaging window"
      );
    }
    await sendDirectMessage(
      accessToken,
      automation.instagramAccount.instagramId,
      userId,
      renderMessageWithoutLink({
        message: automation.followUpMessage,
        commenterName: commenterName ?? null,
      })
    );
  } catch (error) {
    await prisma.dmLog.update({
      where,
      data: { status: "FAILED", errorMessage: formatError(error) },
    });
    if (
      error instanceof MessagingWindowClosedError ||
      error instanceof TokenExpiredError ||
      error instanceof PermissionError
    ) {
      throw new PermanentJobFailureError(formatError(error));
    }
    throw error;
  }
  await prisma.dmLog.update({
    where,
    data: { status: "SENT", dmSentAt: new Date(), errorMessage: null },
  });
}

/**
 * Reply to an inbound DM whose text matches a campaign's keywords.
 *
 * The user has messaged us, so the conversation is already open: this path
 * skips the opening DM (which exists to work around private-reply limits from
 * comments) and delivers the reveal directly, honouring the follow gate.
 * Dedup is per inbound message id, so each message triggers at most one reply.
 */
export async function processMessage(
  job: JobContext<ProcessMessageJob>
): Promise<void> {
  const { instagramAccountId, messageId, messageText, senderId } = job.data;

  console.log(`[DM Worker] processMessage START: account=${instagramAccountId}, messageId=${messageId}, senderId=${senderId}, text="${messageText.slice(0, 100)}"`);

  const automations = await prisma.automation.findMany({
    where: {
      dmTriggerEnabled: true,
      isActive: true,
      instagramAccount: { instagramId: instagramAccountId },
    },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: { slug: true, label: true, destinationUrl: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[DM Worker] processMessage: found ${automations.length} active DM-triggered campaigns for account ${instagramAccountId}`);

  const dedupeId = `dm:${messageId}`;
  let matchedAny = false;

  for (const automation of automations) {
    const matchResult = automation.matchAnyWord
      ? { matched: true, matchedKeyword: null }
      : matchKeywords(
          messageText,
          automation.keywords,
          automation.wholeWordMatch
        );

    if (!matchResult.matched) {
      console.log(`[DM Worker] processMessage: campaign "${automation.name}" (${automation.id}) keywords did NOT match "${messageText.slice(0, 50)}"`);
      continue;
    }
    
    console.log(`[DM Worker] processMessage: campaign "${automation.name}" (${automation.id}) MATCHES with keyword "${matchResult.matchedKeyword ?? 'any'}"`);
    matchedAny = true;

    const existingLog = await prisma.dmLog.findUnique({
      where: {
        automationId_commentId: {
          automationId: automation.id,
          commentId: dedupeId,
        },
      },
    });

    // Already replied to this message (or deliberately skipped it) — a retry
    // of the job must not send a second DM.
    if (
      existingLog?.status === "SENT" ||
      existingLog?.status === "SKIPPED_PLAN_LIMIT"
    ) {
      console.log(`[DM Worker] processMessage: campaign "${automation.name}" already replied to this message (status=${existingLog.status}), skipping`);
      continue;
    }
    
    console.log(`[DM Worker] processMessage: proceeding with campaign "${automation.name}" - existingLog=${existingLog ? JSON.stringify({status: existingLog.status}) : 'null'}`);

    const logBase = {
      workspaceId: automation.workspaceId,
      automationId: automation.id,
      instagramAccountId: automation.instagramAccountId,
      commenterId: senderId,
      commentText: messageText,
      commentId: dedupeId,
      matchedKeyword: matchResult.matchedKeyword,
    };

    if (!automation.instagramAccount.accessToken) {
      console.log(`[DM Worker] processMessage: campaign "${automation.name}" has NO access token, marking FAILED`);
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId: dedupeId,
          },
        },
        create: {
          ...logBase,
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
        update: {
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
      });
      continue;
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(automation.instagramAccount.accessToken);
      console.log(`[DM Worker] processMessage: successfully decrypted access token for campaign "${automation.name}"`);
    } catch (decryptError) {
      const decryptErrorMsg = decryptError instanceof Error ? decryptError.message : String(decryptError);
      console.log(`[DM Worker] processMessage: FAILED to decrypt access token for campaign "${automation.name}": ${decryptErrorMsg}`);
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId: dedupeId,
          },
        },
        create: {
          ...logBase,
          status: "FAILED",
          errorMessage: `Failed to decrypt Instagram access token: ${decryptErrorMsg}`,
        },
        update: {
          status: "FAILED",
          errorMessage: `Failed to decrypt Instagram access token: ${decryptErrorMsg}`,
        },
      });
      continue;
    }

    // Reuse a name captured on an earlier interaction so {username} still
    // renders — the messages webhook carries only the sender's IGSID.
    const priorLog = await prisma.dmLog.findFirst({
      where: { automationId: automation.id, commenterId: senderId },
      select: { commenterName: true },
    });
    const commenterName = priorLog?.commenterName ?? null;

    // Follow gate: anyone not confirmed as a follower gets the prompt instead of
    // the link, with the same `followcheck:` button that re-verifies on tap.
    // `null` (unverifiable) prompts too — this is first contact, exactly like a
    // comment, so it follows processComment's fail-closed rule rather than the
    // postback path's fail-open one. Fail-open is only safe after a tap, where
    // the user has already claimed to follow; here it would hand the link to
    // anyone whose status the API happens not to resolve.
    let sendFollowPrompt = false;
    if (automation.requireFollow) {
      console.log(`[DM Worker] processMessage: checking follow status for user ${senderId} (requireFollow=true)`);
      const follows = await getUserFollowStatus(accessToken, senderId);
      sendFollowPrompt = follows !== true;
      console.log(`[DM Worker] processMessage: follow status for ${senderId}: follows=${follows}, sendFollowPrompt=${sendFollowPrompt}`);
    } else {
      console.log(`[DM Worker] processMessage: requireFollow=false, skipping follow gate check`);
    }

    // Atomic DM deduplication: two workers can both pass the early
    // existingLog check and both reach the Meta call. Claim PENDING
    // atomically with an advisory lock so only one proceeds to the
    // actual send.
    try {
      let canProceed = true;
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeId + ":" + automation.id}))`;
        const existing = await tx.dmLog.findUnique({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId: dedupeId,
            },
          },
          select: { status: true },
        });
        if (
          existing?.status === "SENT" ||
          existing?.status === "SKIPPED_PLAN_LIMIT" ||
          existing?.status === "PENDING"
        ) {
          canProceed = false;
          return;
        }
        await tx.dmLog.upsert({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId: dedupeId,
            },
          },
          create: {
            ...logBase,
            commenterName,
            status: "PENDING",
            attempts: job.attemptsMade + 1,
          },
          update: {
            status: "PENDING",
            attempts: job.attemptsMade + 1,
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: null,
          },
        });
      });
      if (!canProceed) continue;
    } catch (error) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (isUniqueViolation) continue;
      throw error;
    }

    const usage = await reserveWorkspaceDMSend(automation.workspaceId);
    if (!usage.allowed) {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId: dedupeId,
          },
        },
        create: {
          ...logBase,
          status: "SKIPPED_PLAN_LIMIT",
          errorMessage: `Monthly DM limit reached (${usage.limit})`,
        },
        update: {
          status: "SKIPPED_PLAN_LIMIT",
          errorMessage: `Monthly DM limit reached (${usage.limit})`,
        },
      });
      continue;
    }

    try {
      console.log(`[DM Worker] processMessage: sending reply - sendFollowPrompt=${sendFollowPrompt}, hasLinks=${automation.trackedLinks.length > 0}, followUpEnabled=${automation.followUpEnabled}`);
      
      if (sendFollowPrompt) {
        const promptText = renderMessageWithoutLink({
          message:
            automation.followPromptMessage ||
            "Almost there! Follow me and tap the button below to grab your link 💛",
          commenterName,
        });
        console.log(`[DM Worker] processMessage: sending follow prompt to ${senderId}`);
        await sendDirectMessageWithButton(
          accessToken,
          automation.instagramAccount.instagramId,
          senderId,
          promptText,
          automation.followPromptButtonLabel || "I'm following ✅",
          `followcheck:${automation.id}`
        );
        console.log(`[DM Worker] processMessage: follow prompt sent successfully`);
      } else {
        console.log(`[DM Worker] processMessage: sending reveal direct message to ${senderId}`);
        await sendRevealDirectMessage(
          accessToken,
          automation,
          senderId,
          commenterName,
          "message trigger"
        );
        console.log(`[DM Worker] processMessage: reveal direct message sent successfully`);

        // The link has been delivered, so the appreciation follow-up applies
        // here exactly as it does after a button tap. Not scheduled behind the
        // follow prompt — no link went out yet in that branch.
        if (automation.followUpEnabled && automation.followUpMessage?.trim()) {
          console.log(`[DM Worker] processMessage: scheduling follow-up for ${senderId}, delay=${automation.followUpDelayMinutes ?? 0}min`);
          await enqueueFollowUpJob(
            {
              instagramAccountId: automation.instagramAccount.instagramId,
              userId: senderId,
              automationId: automation.id,
              commenterName,
            },
            {
              delayMs: Math.max(0, automation.followUpDelayMinutes ?? 0) * 60_000,
              idempotencyKey: `followup_${automation.id}_${senderId}`,
            }
          );
          console.log(`[DM Worker] processMessage: follow-up job scheduled successfully`);
        } else {
          console.log(`[DM Worker] processMessage: no follow-up configured (followUpEnabled=${automation.followUpEnabled}, followUpMessage=${automation.followUpMessage ? 'has message' : 'empty/null'})`);
        }
      }

      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId: dedupeId,
          },
        },
        create: {
          ...logBase,
          commenterName,
          status: "SENT",
          dmSentAt: new Date(),
        },
        update: {
          status: "SENT",
          dmSentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId: dedupeId,
          },
        },
        create: {
          ...logBase,
          commenterName,
          status: "FAILED",
          attempts: job.attemptsMade + 1,
          errorMessage: formatError(error),
        },
        update: {
          status: "FAILED",
          attempts: job.attemptsMade + 1,
          errorMessage: formatError(error),
        },
      });
      throw error;
    }
  }

  // Inbox automations (feature-rich replacement for the legacy per-account
  // fallback reply): ordered DM-only rules — keyword → AI intent → catch-all.
  // Fires once per inbound message id, after all campaign keyword checks fail.
  // First matching rule wins; AI failures fall through to the catch-all
  // instead of failing the job.
  if (!matchedAny) {
    console.log(`[DM Worker] processMessage: no campaign matched, checking inbox automations...`);
    const inboxResult = await processInboxAutomations({
      instagramAccountId,
      messageId,
      messageText,
      senderId,
      attemptsMade: job.attemptsMade,
    });
    console.log(`[DM Worker] processMessage: inbox automations result=${inboxResult}, matchedAny=${matchedAny}`);
  } else {
    console.log(`[DM Worker] processMessage: skipped inbox automations because campaign matched (matchedAny=${matchedAny})`);
  }
  
  console.log(`[DM Worker] processMessage COMPLETE: account=${instagramAccountId}, messageId=${messageId}`);
}

/**
 * Simplified inbox automation: one master row per account.
 * Only two types: AI reply (knowledge textbox, plain-text, no links)
 * and fallback (keyword list or catch-all). AI is tried first when
 * enabled and budget allows; on failure it falls through to fallback.
 * This removes the old 3-tier (KEYWORD → AI_INTENT → ALWAYS) maze
 * that caused price queries to get "Heya" keyword replies.
 */
type InboxConfig = {
  id: string;
  workspaceId: string;
  instagramAccountId: string;
  isActive: boolean;
  aiEnabled: boolean;
  knowledge: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  fallbackKeywords: string[];
  fallbackMessage: string;
  wholeWordMatch: boolean;
  matchAnyWord: boolean;
};

async function processInboxAutomations(opts: {
  instagramAccountId: string;
  messageId: string;
  messageText: string;
  senderId: string;
  attemptsMade: number;
}): Promise<boolean> {
  const { instagramAccountId, messageId, messageText, senderId, attemptsMade } = opts;

  const account = await prisma.instagramAccount.findUnique({
    where: { instagramId: instagramAccountId },
    select: { id: true, workspaceId: true, instagramId: true, accessToken: true },
  });
  if (!account) return false;

  const config = (await prisma.inboxAutomation.findUnique({
    where: { instagramAccountId: account.id },
  })) as InboxConfig | null;

  if (!config || !config.isActive) return false;

  const priorLog = await prisma.dmLog.findFirst({
    where: { commenterId: senderId },
    select: { commenterName: true },
  });
  const commenterName = priorLog?.commenterName ?? null;

  // Tier 1: AI reply — tried first when enabled. On success we send and return.
  // On any failure (budget, timeout, empty) we fall through to fallback.
  if (config.aiEnabled && isAIEnabled()) {
    const budget = await checkAiBudget(account.workspaceId);
    if (budget.allowed) {
      const aiResult = await tryInboxAIReply({
        account,
        config,
        messageId,
        messageText,
        senderId,
        commenterName,
        attemptsMade,
      });
      if (aiResult) return true;
    }
  }

  // Tier 2: Fallback — keyword-gated or catch-all when keywords empty.
  const fallbackText = config.fallbackMessage?.trim();
  if (!fallbackText) return false;

  const isCatchAll = config.fallbackKeywords.length === 0 && !config.matchAnyWord;
  // When keywords exist we gate; when empty or matchAnyWord we always send.
  let shouldSendFallback = false;
  if (config.matchAnyWord || isCatchAll) {
    shouldSendFallback = true;
  } else {
    const hit = matchKeywords(messageText, config.fallbackKeywords, config.wholeWordMatch).matched;
    shouldSendFallback = hit;
  }
  if (!shouldSendFallback) return false;

  return deliverInboxFallback({
    account,
    config,
    messageId,
    messageText,
    senderId,
    commenterName,
    attemptsMade,
  });
}

async function tryInboxAIReply(opts: {
  account: { id: string; workspaceId: string; instagramId: string; accessToken: string };
  config: InboxConfig;
  messageId: string;
  messageText: string;
  senderId: string;
  commenterName: string | null;
  attemptsMade: number;
}): Promise<boolean> {
  const { account, config, messageId, messageText, senderId, commenterName, attemptsMade } = opts;
  const dedupeId = `dm:inbox:${messageId}`;

  let replyText: string | null = null;
  let aiModel: string | null = null;
  let aiLatencyMs: number | null = null;
  const started = Date.now();
  try {
    await consumeAiBudget(account.workspaceId);
    let history: string[] = [];
    try {
      const recent = await prisma.dmLog.findMany({
        where: { commenterId: senderId, instagramAccountId: account.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { commentText: true },
      });
      history = recent.map((r) => r.commentText).reverse();
    } catch {
      history = [];
    }
    const gen = await generateReply({
      message: messageText,
      knowledge: config.knowledge ?? "",
      username: commenterName,
      history,
    });
    replyText = gen.text;
    aiModel = config.aiModel?.trim() || gen.model || getAIModel();
    aiLatencyMs = Date.now() - started;
  } catch (error) {
    aiLatencyMs = Date.now() - started;
    await prisma.operationalEvent
      .create({
        data: {
          workspaceId: account.workspaceId,
          source: "AI",
          level: "WARNING",
          message: `AI reply failed, falling through to fallback: ${formatError(error)}`,
          payload: { instagramAccountId: account.instagramId },
        },
      })
      .catch(() => {});
    return false;
  }

  if (!replyText?.trim()) return false;

  return sendInboxDM({
    account,
    configId: config.id,
    dedupeId,
    messageText,
    senderId,
    commenterName,
    attemptsMade,
    replyText,
    aiUsed: true,
    aiModel,
    aiLatencyMs,
  });
}

async function deliverInboxFallback(opts: {
  account: { id: string; workspaceId: string; instagramId: string; accessToken: string };
  config: InboxConfig;
  messageId: string;
  messageText: string;
  senderId: string;
  commenterName: string | null;
  attemptsMade: number;
}): Promise<boolean> {
  const { account, config, messageId, messageText, senderId, commenterName, attemptsMade } = opts;
  const dedupeId = `dm:inbox:${messageId}`;
  const replyText = renderMessageWithoutLink({ message: config.fallbackMessage, commenterName });
  if (!replyText?.trim()) return false;
  return sendInboxDM({
    account,
    configId: config.id,
    dedupeId,
    messageText,
    senderId,
    commenterName,
    attemptsMade,
    replyText,
    aiUsed: false,
    aiModel: null,
    aiLatencyMs: null,
  });
}

/**
 * Shared DM send with advisory lock, plan limit, and audit.
 */
async function sendInboxDM(opts: {
  account: { id: string; workspaceId: string; instagramId: string; accessToken: string };
  configId: string;
  dedupeId: string;
  messageText: string;
  senderId: string;
  commenterName: string | null;
  attemptsMade: number;
  replyText: string;
  aiUsed: boolean;
  aiModel: string | null;
  aiLatencyMs: number | null;
}): Promise<boolean> {
  const { account, configId, dedupeId, messageText, senderId, commenterName, attemptsMade, replyText, aiUsed, aiModel, aiLatencyMs } = opts;

  if (!account.accessToken) {
    await prisma.dmLog.create({
      data: {
        workspaceId: account.workspaceId,
        automationId: null,
        inboxAutomationId: configId,
        instagramAccountId: account.id,
        commenterId: senderId,
        commenterName,
        commentText: messageText,
        commentId: dedupeId,
        status: "FAILED",
        errorMessage: "No Instagram access token available",
        aiUsed: aiUsed || undefined,
        aiModel,
        aiLatencyMs,
      },
    });
    return true;
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(account.accessToken);
  } catch (decryptError) {
    const msg = decryptError instanceof Error ? decryptError.message : String(decryptError);
    await prisma.dmLog.create({
      data: {
        workspaceId: account.workspaceId,
        automationId: null,
        inboxAutomationId: configId,
        instagramAccountId: account.id,
        commenterId: senderId,
        commenterName,
        commentText: messageText,
        commentId: dedupeId,
        status: "FAILED",
        errorMessage: `Failed to decrypt Instagram access token: ${msg}`,
        aiUsed: aiUsed || undefined,
        aiModel,
        aiLatencyMs,
      },
    });
    return true;
  }

  let canProceed = true;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeId}))`;
      const existing = await tx.dmLog.findFirst({
        where: { commentId: dedupeId, instagramAccountId: account.id },
        select: { status: true },
      });
      if (existing?.status === "SENT" || existing?.status === "SKIPPED_PLAN_LIMIT" || existing?.status === "PENDING") {
        canProceed = false;
        return;
      }
      await tx.dmLog.create({
        data: {
          workspaceId: account.workspaceId,
          automationId: null,
          inboxAutomationId: configId,
          instagramAccountId: account.id,
          commenterId: senderId,
          commenterName,
          commentText: messageText,
          commentId: dedupeId,
          status: "PENDING",
          attempts: attemptsMade + 1,
          aiUsed: aiUsed || undefined,
          aiModel,
          aiLatencyMs,
        },
      });
    });
  } catch (error) {
    const isUniqueViolation = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
    if (isUniqueViolation) return true;
    throw error;
  }
  if (!canProceed) return true;

  const usage = await reserveWorkspaceDMSend(account.workspaceId);
  if (!usage.allowed) {
    await prisma.dmLog.updateMany({
      where: { commentId: dedupeId, instagramAccountId: account.id, workspaceId: account.workspaceId },
      data: { status: "SKIPPED_PLAN_LIMIT", errorMessage: `Monthly DM limit reached (${usage.limit})` },
    });
    return true;
  }

  try {
    await sendDirectMessage(accessToken, account.instagramId, senderId, replyText);
    await prisma.dmLog.updateMany({
      where: { commentId: dedupeId, instagramAccountId: account.id, workspaceId: account.workspaceId },
      data: { status: "SENT", dmSentAt: new Date(), errorMessage: null },
    });
    return true;
  } catch (error) {
    const errorMsg = formatError(error);
    await releaseWorkspaceDMReservation(account.workspaceId, usage.periodStart);
    await prisma.dmLog.updateMany({
      where: { commentId: dedupeId, instagramAccountId: account.id, workspaceId: account.workspaceId },
      data: { status: "FAILED", attempts: attemptsMade + 1, errorMessage: errorMsg },
    });
    throw error;
  }
}/**
 * Record a terminal failure for one job run.
 *
 * The Trigger.dev tasks call this from their `onFailure` hook once the last
 * attempt has failed. It replaces the BullMQ worker's "failed" event handler.
 * This OperationalEvent row is also what the diagnostics page lists as a worker
 * alert, so a failure is recorded once rather than in two places.
 */
export interface JobFailureContext {
  taskId: string;
  runId: string;
  attemptsMade: number;
  data: { instagramAccountId?: string; commentId?: string } | undefined;
}

export async function recordJobFailure(
  failure: JobFailureContext,
  error: Error
): Promise<void> {
  const instagramAccountId = failure.data?.instagramAccountId;
  const commentId = failure.data?.commentId ?? null;

  try {
    const account = instagramAccountId
      ? await prisma.instagramAccount.findUnique({
          where: { instagramId: instagramAccountId },
          select: { workspaceId: true },
        })
      : null;

    await prisma.operationalEvent.create({
      data: {
        workspaceId: account?.workspaceId ?? null,
        source: "WORKER",
        level: "ERROR",
        message: `DM job ${failure.taskId} (${failure.runId}) failed: ${error.message}`,
        payload: {
          taskId: failure.taskId,
          runId: failure.runId,
          attemptsMade: failure.attemptsMade,
          instagramAccountId: instagramAccountId ?? null,
          commentId,
        },
      },
    });
  } catch (recordError) {
    console.error(
      "[DM Worker] Failed to record job failure:",
      formatError(recordError)
    );
  }
}


