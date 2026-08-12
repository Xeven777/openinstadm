/**
 * Snapshot Cleanup Cron — Unit Tests
 *
 * Covers bearer-token auth (CRON_SECRET with NEXTAUTH_SECRET fallback) and the
 * expired-snapshot sweep (delete anything expired more than 7 days ago).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    apiSnapshot: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
}));

import { GET } from "../app/api/cron/snapshot-cleanup/route";

const KEEP_EXPIRED_FOR_DAYS = 7;
const CRON_SECRET = "cron_secret_123";
const NEXTAUTH_SECRET = "nextauth_secret_456";
const DAY_MS = 24 * 60 * 60 * 1000;

function buildRequest(authorization?: string): Parameters<typeof GET>[0] {
  return new Request("https://app.example.com/api/cron/snapshot-cleanup", {
    headers: authorization ? { authorization } : undefined,
  }) as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockPrisma.apiSnapshot.deleteMany.mockResolvedValue({ count: 0 });
});

describe("snapshot cleanup cron", () => {
  it("rejects requests without an authorization header", async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mockPrisma.apiSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);

    const response = await GET(buildRequest("Bearer wrong_token"));

    expect(response.status).toBe(401);
    expect(mockPrisma.apiSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("sweeps snapshots expired more than 7 days ago and reports the count", async () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockPrisma.apiSnapshot.deleteMany.mockResolvedValue({ count: 5 });

    const before = Date.now();
    const response = await GET(buildRequest(`Bearer ${CRON_SECRET}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(5);

    // One sweep, cut off at now minus 7 days (within a small tolerance for
    // the time that elapses while the test runs).
    expect(mockPrisma.apiSnapshot.deleteMany).toHaveBeenCalledTimes(1);
    const cutoff = mockPrisma.apiSnapshot.deleteMany.mock
      .calls[0][0] as { where: { expiresAt: { lt: Date } } };
    expect(cutoff.where.expiresAt.lt).toBeInstanceOf(Date);

    const cutoffMs = cutoff.where.expiresAt.lt.getTime();
    const expectedMs = before - KEEP_EXPIRED_FOR_DAYS * DAY_MS;
    expect(Math.abs(cutoffMs - expectedMs)).toBeLessThan(5000);

    // The reported cutoff round-trips the exact value used in the query.
    expect(body.data.cutoff).toBe(cutoff.where.expiresAt.lt.toISOString());
  });

  it("falls back to NEXTAUTH_SECRET when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", NEXTAUTH_SECRET);

    const response = await GET(buildRequest(`Bearer ${NEXTAUTH_SECRET}`));

    expect(response.status).toBe(200);
    expect(mockPrisma.apiSnapshot.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("returns success with zero deletions when nothing is expired", async () => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    mockPrisma.apiSnapshot.deleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(buildRequest(`Bearer ${CRON_SECRET}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, data: { deleted: 0 } });
  });
});
