import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Sweeps expired API snapshots.
 *
 * Snapshots are overwritten in place by stable keys, so growth is already
 * bounded — but a deleted account, a changed key scheme, or a failed upsert
 * can still orphan rows. Anything that expired more than this long ago is
 * unrecoverable garbage and can be removed.
 */
const KEEP_EXPIRED_FOR_DAYS = 7;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_EXPIRED_FOR_DAYS);

  const { count } = await prisma.apiSnapshot.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });

  return NextResponse.json({
    success: true,
    data: {
      deleted: count,
      cutoff: cutoff.toISOString(),
    },
  });
}
