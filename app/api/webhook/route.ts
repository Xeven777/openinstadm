import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { enqueueDMJobs, type DmJobRequest } from "@/lib/jobs/enqueue";
import {
  COMMENT_TASK_ID,
  MESSAGE_TASK_ID,
  POSTBACK_TASK_ID,
} from "@/lib/jobs/types";
import {
  parseCommentEvents,
  parseMessageEvents,
  parsePostbackEvents,
  parseReadEvents,
  verifyWebhookSignature,
} from "@/lib/meta/webhook";
import { Prisma } from "@/app/generated/prisma/client";

const OPENING_DM_READ_FALLBACK_DELAY_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  }

  return NextResponse.json(
    { success: false, error: "Verification failed" },
    {
      status: 403,
      headers: { "Cache-Control": "no-store, must-revalidate" },
    }
  );
}

export async function POST(request: NextRequest) {
  console.log(`[Webhook] === NEW WEBHOOK REQUEST RECEIVED ===`);
  console.log(`[Webhook] URL: ${request.url}`);
  console.log(`[Webhook] Method: ${request.method}`);
  console.log(`[Webhook] Content-Type: ${request.headers.get("content-type")}`);
  console.log(`[Webhook] x-hub-signature-256: ${request.headers.get("x-hub-signature-256") ? "PRESENT" : "MISSING"}`);
  console.log(`[Webhook] x-meta-signature: ${request.headers.get("x-meta-signature") ? "PRESENT" : "MISSING"}`);
  console.log(`[Webhook] user-agent: ${request.headers.get("user-agent") || "unknown"}`);
  
  const rawBody = await request.text();
  console.log(`[Webhook] Body length: ${rawBody.length} chars`);
  console.log(`[Webhook] Body preview: ${rawBody.slice(0, 500)}`);
  
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    // Record the attempt so a signature mismatch is visible rather than a
    // silent 401. This is the common symptom of FACEBOOK_APP_SECRET being
    // set to the wrong app's secret for the webhook's signing key.
    console.log(`[Webhook] *** SIGNATURE VERIFICATION FAILED ***`);
    console.log(`[Webhook] Has signature header: ${Boolean(signature)}`);
    console.log(`[Webhook] FACEBOOK_APP_SECRET set: ${Boolean(process.env.FACEBOOK_APP_SECRET)}`);
    console.log(`[Webhook] INSTAGRAM_APP_SECRET set: ${Boolean(process.env.INSTAGRAM_APP_SECRET)}`);
    
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
  
  console.log(`[Webhook] Signature verification PASSED`);

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

    // Everything parsed from this payload is collected here and triggered in one
    // batch at the end of the handler. Trigger.dev batches per task, so a
    // payload with ten comments costs one API call instead of ten.
    const jobs: DmJobRequest[] = [];

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
      jobs.push({
        task: COMMENT_TASK_ID,
        data: {
          instagramAccountId: event.instagramAccountId,
          commentId: event.commentId,
          commentText: event.commentText,
          commenterId: event.commenterId,
          commenterName: event.commenterName,
          mediaId: event.mediaId,
          source: "WEBHOOK",
        },
        options: {
          // Meta retries webhook deliveries, so the same comment can arrive
          // twice. The key collapses the duplicate trigger into one run.
          idempotencyKey: `comment_${event.instagramAccountId}_${event.commentId}`,
        },
      });

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
      jobs.push({
        task: POSTBACK_TASK_ID,
        data: {
          instagramAccountId: event.instagramAccountId,
          userId: event.userId,
          payload: event.payload,
          mid: event.mid,
        },
        options: {
          // The payload is "reveal:<id>". A key containing colons is needlessly
          // hostile to anything that later splits on them, so keep underscores.
          idempotencyKey: `postback_${event.instagramAccountId}_${event.userId}_${(
            event.mid ?? event.payload
          ).replace(/:/g, "_")}`,
        },
      });
    }

    // Inbound DMs → keyword-triggered autoreply.
    const messageEvents = parseMessageEvents(
      payload as Parameters<typeof parseMessageEvents>[0]
    );

    console.log(`[Webhook] Parsed ${messageEvents.length} inbound DM message events`);
    
    for (const event of messageEvents) {
      console.log(`[Webhook] Inbound DM event: instagramAccountId=${event.instagramAccountId}, messageId=${event.messageId}, senderId=${event.senderId}, text="${event.messageText.slice(0, 100)}"`);
    }

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

    console.log(`[Webhook] Found ${messageAccounts.length} Instagram accounts for message events`);

    for (const event of messageEvents) {
      console.log(`[Webhook] Queuing MESSAGE_JOB for: instagramAccountId=${event.instagramAccountId}, messageId=${event.messageId}`);
      // base64url keeps the key injective whatever the mid contains —
      // substituting characters would let two distinct mids collapse onto one
      // key and silently drop a reply.
      const messageKey = `message_${event.instagramAccountId}_${Buffer.from(
        event.messageId
      ).toString("base64url")}`;
      jobs.push({
        task: MESSAGE_TASK_ID,
        data: {
          instagramAccountId: event.instagramAccountId,
          messageId: event.messageId,
          messageText: event.messageText,
          senderId: event.senderId,
        },
        options: { idempotencyKey: messageKey },
      });
      console.log(`[Webhook] Queued MESSAGE_JOB: ${messageKey}`);

      const wsId = messageAccountMap.get(event.instagramAccountId);
      if (wsId && !webhookWorkspaceId) {
        webhookWorkspaceId = wsId;
      }
    }

    // If a user reads the opening DM and never taps the button, deliver the
    // same next-step DM after five minutes. The handler no-ops this delayed run
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
          jobs.push({
            task: POSTBACK_TASK_ID,
            data: {
              instagramAccountId: igAccountId,
              userId: event.userId,
              payload: `reveal:${automationId}`,
              fallback: true,
            },
            options: {
              delayMs: OPENING_DM_READ_FALLBACK_DELAY_MS,
              idempotencyKey: `read_fallback_${igAccountId}_${event.userId}_${automationId}`,
            },
          });
        }
      }
    }

    // Trigger the payload's jobs before marking the event processed: if the
    // runner call throws, the catch below records the webhook as FAILED instead
    // of acknowledging work that was never queued.
    await enqueueDMJobs(jobs);

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        ...(webhookWorkspaceId && { workspaceId: webhookWorkspaceId }),
      },
    });

    console.log(`[Webhook] === WEBHOOK PROCESSED SUCCESSFULLY ===`);
    console.log(`[Webhook] WebhookEvent id: ${webhookEvent.id}`);
    console.log(`[Webhook] Workspace ID: ${webhookWorkspaceId || 'none'}`);

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
