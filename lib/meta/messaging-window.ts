/**
 * Instagram's 24-hour messaging window, per (account, user).
 *
 * Meta only lets a business send a message within 24 hours of the user's last
 * inbound message or button tap. A follow-up scheduled for later therefore has
 * to know when the user last responded, or it will be rejected with
 * "outside of allowed window" (see `MessagingWindowClosedError`).
 *
 * This used to be a Redis key with a Lua compare-and-set. It is now one
 * Postgres row per (account, user), claimed with the same rule: the stored time
 * only ever moves forward, so a delayed or duplicate webhook cannot extend an
 * already-expired window.
 *
 * Reading a DM or leaving a comment does NOT open a window — only an inbound
 * message or a button tap does, which is why the webhook stores the timestamp
 * from `parseMessagingInteractions` and not from every event it receives.
 */

import { prisma } from "@/lib/db/client";

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
// Leave room for network latency at the end of the permitted window.
const SEND_MARGIN_MS = 60_000;

/**
 * Record Meta's event time, never webhook arrival time. Duplicate/delayed
 * webhooks must not extend the window or overwrite a newer interaction.
 */
export async function recordMessagingInteraction(
  accountId: string,
  userId: string,
  timestamp: number,
): Promise<void> {
  const now = Date.now();
  if (
    !Number.isFinite(timestamp) ||
    timestamp <= 0 ||
    timestamp > now + 60_000
  ) {
    return;
  }

  const interactionAt = Math.min(timestamp, now);
  if (interactionAt + MESSAGING_WINDOW_MS <= now) return;

  // One statement: insert the first response, and otherwise only move the
  // stored time forward. An out-of-order webhook carries an older timestamp and
  // matches the UPDATE's WHERE, so it changes nothing. The row lock makes this
  // safe against two webhooks arriving at once.
  await prisma.$executeRaw`
    INSERT INTO "MessagingInteraction" ("instagramAccountId", "userId", "respondedAt", "updatedAt")
    VALUES (${accountId}, ${userId}, ${new Date(interactionAt)}, now())
    ON CONFLICT ("instagramAccountId", "userId") DO UPDATE
      SET "respondedAt" = EXCLUDED."respondedAt",
          "updatedAt" = now()
      WHERE "MessagingInteraction"."respondedAt" < EXCLUDED."respondedAt"
  `;
}

export async function hasOpenMessagingWindow(
  accountId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.messagingInteraction.findUnique({
    where: {
      instagramAccountId_userId: {
        instagramAccountId: accountId,
        userId,
      },
    },
    select: { respondedAt: true },
  });

  if (!row) return false;

  const age = Date.now() - row.respondedAt.getTime();
  // `age >= 0` guards a stored time in the future, which would otherwise look
  // like a permanently open window.
  return age >= 0 && age < MESSAGING_WINDOW_MS - SEND_MARGIN_MS;
}
