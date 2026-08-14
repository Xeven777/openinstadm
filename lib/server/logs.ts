import { cacheLife, cacheTag } from "next/cache";
import { DmStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * Shared server-side query for the paginated DM log table.
 *
 * Used by both the API route handler and the server-rendered Logs page so the
 * where-clause building and pagination live in exactly one place. `createdAt`
 * is converted to an ISO string so the result is plain serializable data that
 * can be JSON-serialized (API) or passed straight into a client island.
 */

export interface LogsPageParams {
  page?: number;
  limit?: number;
  status?: string | null;
  instagramAccountId?: string | null;
}

export interface DmLogListItem {
  id: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  automation: { name: string; keywords: string[] };
  instagramAccount: { username: string };
}

export interface LogsPageResult {
  logs: DmLogListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function parseLogsPageParams(params: LogsPageParams) {
  const page = Math.max(
    1,
    params.page && Number.isFinite(params.page) ? params.page : 1,
  );
  const limit = Math.min(
    50,
    Math.max(
      1,
      params.limit && Number.isFinite(params.limit) ? params.limit : 20,
    ),
  );
  const parsedStatus =
    params.status && Object.values(DmStatus).includes(params.status as DmStatus)
      ? (params.status as DmStatus)
      : null;

  return { page, limit, parsedStatus };
}

export async function getLogsPage(
  workspaceId: string,
  params: LogsPageParams,
): Promise<LogsPageResult> {
  "use cache";
  // 15 min stale / 2 h hard expiry — logs are worker-written and the client
  // router already holds the page for 4 min, so fresh visits only pay the query
  // once per window per filter combination.
  cacheLife({ stale: 900, revalidate: 900, expire: 7200 });
  cacheTag(`logs:${workspaceId}`);

  const { page, limit, parsedStatus } = parseLogsPageParams(params);
  const skip = (page - 1) * limit;

  const where = {
    workspaceId,
    ...(parsedStatus ? { status: parsedStatus } : {}),
    ...(params.instagramAccountId && params.instagramAccountId !== "all"
      ? { instagramAccountId: params.instagramAccountId }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.dmLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        automation: { select: { name: true, keywords: true } },
        instagramAccount: { select: { username: true } },
      },
    }),
    prisma.dmLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      status: log.status,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
