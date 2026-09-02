import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDMQueue } from "@/lib/queue/client";
import {
  parseCommentEvents,
  parseMessageEvents,
  parsePostbackEvents,
  parseReadEvents,
  verifyWebhookSignature,
} from "@/lib/meta/webhook";
import { MESSAGE_JOB_NAME, POSTBACK_JOB_NAME } from "@/lib/queue/client";
import { Prisma } from "@/app/generated/prisma/client";

const OPENING_DM_READ_FALLBACK_DELAY_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { success: false, error: "Verification failed" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    // Record the attempt so a signature mismatch is visible rather than a
    // silent 401. This is the common symptom of FACEBOOK_APP_SECRET being
    // set to the wrong app's secret for the webhook's signing key.
    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "WARNING",
          message: "Webhook signature verification failed",
          payload: {
            hadSignatureHeader: Boolean(signature),
            bodyLength: rawBody.length,
            bodyPreview: rawBody.slice(0, 200),
          },
        },
      })
      .catch(() => {});
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      object:
        typeof payload === "object" && payload && "object" in payload
          ? String(payload.object)
          : null,
      payload: payload as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });

  try {
    const commentEvents = parseCommentEvents(
      payload as Parameters<typeof parseCommentEvents>[0]
    );
    const queue = getDMQueue();

    const commentAccountIds = [
      ...new Set(commentEvents.map((e) => e.instagramAccountId)),
    ];
    const commentAccounts =
      commentAccountIds.length > 0
        ? await prisma.instagramAccount.findMany({
            where: { instagramId: { in: commentAccountIds } },
            select: { instagramId: true, workspaceId: true },
          })
        : [];
    const commentAccountMap = new Map(
      commentAccounts.map((a) => [a.instagramId, a.workspaceId])
    );

    let webhookWorkspaceId: string | null = null;
    for (const event of commentEvents) {
      await queue.add(
        "process-comment",
        {
          instagramAccountId: event.instagramAccountId,
          commentId: event.commentId,
          commentText: event.commentText,
          commenterId: event.commenterId,
          commenterName: event.commenterName,
          mediaId: event.mediaId,
          source: "WEBHOOK",
        },
        {
          jobId: `comment_${event.instagramAccountId}_${event.commentId}`,
        }
      );

      const wsId = commentAccountMap.get(event.instagramAccountId);
      if (wsId && !webhookWorkspaceId) {
        webhookWorkspaceId = wsId;
      }
    }

    // Button taps from opening DMs → deliver the reveal message.
    const postbackEvents = parsePostbackEvents(
      payload as Parameters<typeof parsePostbackEvents>[0]
    );

    for (const event of postbackEvents) {
      await queue.add(
        POSTBACK_JOB_NAME,
        {
          instagramAccountId: event.instagramAccountId,
          userId: event.userId,
          payload: event.payload,
          mid: event.mid,
        },
        {
          // BullMQ forbids ":" in custom job ids, and the payload is
          // "reveal:<id>", so build with underscores and strip any colons.
          jobId: `postback_${event.instagramAccountId}_${event.userId}_${(
            event.mid ?? event.payload
          ).replace(/:/g, "_")}`,
        }
      );
    }

    // Inbound DMs → keyword-triggered autoreply.
    const messageEvents = parseMessageEvents(
      payload as Parameters<typeof parseMessageEvents>[0]
    );

    const messageAccountIds = [
      ...new Set(messageEvents.map((e) => e.instagramAccountId)),
    ];
    const messageAccounts =
      messageAccountIds.length > 0
        ? await prisma.instagramAccount.findMany({
            where: { instagramId: { in: messageAccountIds } },
            select: { instagramId: true, workspaceId: true },
          })
        : [];
    const messageAccountMap = new Map(
      messageAccounts.map((a) => [a.instagramId, a.workspaceId])
    );

    for (const event of messageEvents) {
      await queue.add(
        MESSAGE_JOB_NAME,
        {
          instagramAccountId: event.instagramAccountId,
          messageId: event.messageId,
          messageText: event.messageText,
          senderId: event.senderId,
        },
        {
          // Message ids can contain characters BullMQ rejects in a job id (":"
          // in particular). base64url encodes into exactly the allowed alphabet
          // and stays injective — substituting invalid characters would let two
          // distinct mids collapse onto one job id, silently dropping a reply.
          jobId: `message_${event.instagramAccountId}_${Buffer.from(
            event.messageId
          ).toString("base64url")}`,
        }
      );

      const wsId = messageAccountMap.get(event.instagramAccountId);
      if (wsId && !webhookWorkspaceId) {
        webhookWorkspaceId = wsId;
      }
    }

    // If a user reads the opening DM and never taps the button, deliver the
    // same next-step DM after five minutes. The worker no-ops this delayed job
    // if a real button tap has already delivered the reveal.
    const readEvents = parseReadEvents(
      payload as Parameters<typeof parseReadEvents>[0]
    );

    // Batch: group read events by instagramAccountId to avoid N+1 queries.
    const readEventsByAccount = new Map<
      string,
      { userId: string; dedupeKey: string }[]
    >();
    for (const event of readEvents) {
      const key = event.instagramAccountId;
      const list = readEventsByAccount.get(key) ?? [];
      list.push({
        userId: event.userId,
        dedupeKey: `${event.userId}:${event.instagramAccountId}`,
      });
      readEventsByAccount.set(key, list);
    }

    // One query per distinct instagramAccountId (typically 1) instead of one
    // per read event.
    for (const [igAccountId, events] of readEventsByAccount) {
      const userIds = [...new Set(events.map((e) => e.userId))];
      const openingLogs = await prisma.dmLog.findMany({
        where: {
          commenterId: { in: userIds },
          status: "SENT",
          automation: {
            isActive: true,
            openingDmEnabled: true,
            instagramAccount: {
              instagramId: igAccountId,
            },
          },
        },
        select: {
          commenterId: true,
          automation: {
            select: {
              id: true,
            },
          },
        },
      });

      // Build a map of userId → Set<automationId> for dedup.
      const scheduledByUser = new Map<string, Set<string>>();
      for (const log of openingLogs) {
        if (!log.automation) continue;
        const userId = log.commenterId;
        const automationId = log.automation.id;
        const set = scheduledByUser.get(userId) ?? new Set();
        set.add(automationId);
        scheduledByUser.set(userId, set);
      }

      // Schedule fallback jobs only for automations not already scheduled.
      for (const event of events) {
        const scheduled = scheduledByUser.get(event.userId) ?? new Set();
        for (const automationId of scheduled) {
          await queue.add(
            POSTBACK_JOB_NAME,
            {
              instagramAccountId: igAccountId,
              userId: event.userId,
              payload: `reveal:${automationId}`,
              fallback: true,
            },
            {
              delay: OPENING_DM_READ_FALLBACK_DELAY_MS,
              jobId: `read_fallback_${igAccountId}_${event.userId}_${automationId}`,
            }
          );
        }
      }
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        ...(webhookWorkspaceId && { workspaceId: webhookWorkspaceId }),
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        processedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
