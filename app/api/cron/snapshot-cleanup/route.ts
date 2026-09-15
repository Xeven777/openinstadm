import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Sweeps expired API snapshots + old webhook payloads.
 *
 * Snapshots are overwritten in place by stable keys, so growth is already
 * bounded — but a deleted account, a changed key scheme, or a failed upsert
 * can still orphan rows. Anything that expired more than this long ago is
 * unrecoverable garbage and can be removed.
 *
 * WebhookEvent rows are the raw Meta payloads. They accumulate forever and the
 * comment reconciler's ad-scan reads 30 days of them on every sweep, so
 * pruning here keeps that scan (and storage) bounded. DmLog and
 * OperationalEvent summaries are untouched — only the raw payloads go.
 */
const KEEP_EXPIRED_FOR_DAYS = 7;
const KEEP_WEBHOOKS_FOR_DAYS = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store, must-revalidate" },
      }
    );
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_EXPIRED_FOR_DAYS);

  const webhookCutoff = new Date();
  webhookCutoff.setDate(webhookCutoff.getDate() - KEEP_WEBHOOKS_FOR_DAYS);

  const [{ count: deleted }, { count: webhooksDeleted }] = await Promise.all([
    prisma.apiSnapshot.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    }),
    prisma.webhookEvent.deleteMany({
      where: { createdAt: { lt: webhookCutoff } },
    }),
  ]);

  return NextResponse.json(
    {
      success: true,
      data: {
        deleted,
        webhooksDeleted,
        cutoff: cutoff.toISOString(),
        webhookCutoff: webhookCutoff.toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
