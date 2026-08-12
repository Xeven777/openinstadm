import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";

interface SnapshotKeyParts {
  source: string;
  accountId: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}

interface SnapshotContext {
  workspaceId: string;
  instagramAccountId?: string | null;
  key: string;
  source: string;
}

interface SnapshotReadOptions {
  bypass?: boolean;
}

export interface SnapshotEnvelope<T> {
  data: T;
  fetchedAt: string;
  expiresAt: string;
}

export function buildApiSnapshotKey({
  source,
  accountId,
  params = {},
}: SnapshotKeyParts): string {
  const suffix = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${String(value)}`)
    .join(":");

  return suffix ? `${source}:${accountId}:${suffix}` : `${source}:${accountId}`;
}

export async function getApiSnapshot<T>(
  key: string,
  options: SnapshotReadOptions = {}
): Promise<SnapshotEnvelope<T> | null> {
  if (options.bypass) return null;

  const now = new Date();
  const snapshot = await prisma.apiSnapshot.findUnique({
    where: { key },
    select: { payload: true, fetchedAt: true, expiresAt: true },
  });

  if (!snapshot || snapshot.expiresAt <= now) return null;

  return {
    data: snapshot.payload as T,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    expiresAt: snapshot.expiresAt.toISOString(),
  };
}

export async function setApiSnapshot<T>(
  context: SnapshotContext,
  data: T,
  ttlMs: number
): Promise<SnapshotEnvelope<T>> {
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + ttlMs);

  await prisma.apiSnapshot.upsert({
    where: { key: context.key },
    create: {
      workspaceId: context.workspaceId,
      instagramAccountId: context.instagramAccountId ?? null,
      key: context.key,
      source: context.source,
      payload: data as Prisma.InputJsonValue,
      fetchedAt,
      expiresAt,
    },
    update: {
      workspaceId: context.workspaceId,
      instagramAccountId: context.instagramAccountId ?? null,
      source: context.source,
      payload: data as Prisma.InputJsonValue,
      fetchedAt,
      expiresAt,
    },
  });

  return {
    data,
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function snapshotHeaders(
  ttlSeconds: number,
  cacheStatus: "HIT" | "MISS"
): HeadersInit {
  return {
    "Cache-Control": `private, max-age=${ttlSeconds}`,
    "X-Api-Snapshot": cacheStatus,
  };
}
