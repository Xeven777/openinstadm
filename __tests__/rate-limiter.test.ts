/**
 * Rate Limiter — Unit Tests
 *
 * Tests the hourly private-reply cap enforcement. The counter is a Postgres row
 * claimed by one atomic upsert, so the mock stands in for `prisma.$queryRaw`:
 * the claim returns a row when the window has room, and no row when it is full.
 * Assertions derive from RATE_LIMIT_MAX so they survive a change to the cap.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    windowCounter: {
      deleteMany: vi.fn(),
    },
  },
}));

import {
  checkRateLimit,
  incrementDMCounter,
  reserveDMSlot,
  RATE_LIMIT_MAX,
} from "../lib/utils/rate-limiter";

const windowStart = new Date("2026-09-16T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkRateLimit", () => {
  it("should allow when count is below limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 50 }]);

    const result = await checkRateLimit("account_123");

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(50);
    expect(result.remainingDMs).toBe(RATE_LIMIT_MAX - 50);
    expect(result.shouldRequeue).toBe(false);
    expect(result.shouldSkip).toBe(false);
    expect(result.reserved).toBe(false);
  });

  it("should allow when no counter row exists", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await checkRateLimit("account_123");

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(0);
    expect(result.remainingDMs).toBe(RATE_LIMIT_MAX);
  });

  it("should deny when count reaches the limit", async () => {
    mockQueryRaw.mockResolvedValue([{ count: RATE_LIMIT_MAX }]);

    const result = await checkRateLimit("account_123");

    expect(result.allowed).toBe(false);
    expect(result.shouldRequeue).toBe(true);
    expect(result.shouldSkip).toBe(false);
  });

  it("should skip after max requeue attempts", async () => {
    mockQueryRaw.mockResolvedValue([{ count: RATE_LIMIT_MAX }]);

    const result = await checkRateLimit("account_123", 3);

    expect(result.allowed).toBe(false);
    expect(result.shouldRequeue).toBe(false);
    expect(result.shouldSkip).toBe(true);
  });
});

describe("reserveDMSlot", () => {
  it("should atomically reserve a slot when below the hourly cap", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 51, windowStart }]);

    const result = await reserveDMSlot("account_123");

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result.allowed).toBe(true);
    expect(result.reserved).toBe(true);
    expect(result.currentCount).toBe(51);
    expect(result.remainingDMs).toBe(RATE_LIMIT_MAX - 51);
  });

  it("should recommend requeue when the atomic reserve is denied", async () => {
    // The upsert's WHERE clause failed, so it updated and returned nothing.
    mockQueryRaw.mockResolvedValue([]);

    const result = await reserveDMSlot("account_123", 0);

    expect(result.allowed).toBe(false);
    expect(result.reserved).toBe(false);
    expect(result.shouldRequeue).toBe(true);
    expect(result.shouldSkip).toBe(false);
  });

  it("should skip after max requeue attempts", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await reserveDMSlot("account_123", 3);

    expect(result.allowed).toBe(false);
    expect(result.shouldRequeue).toBe(false);
    expect(result.shouldSkip).toBe(true);
  });
});

describe("incrementDMCounter", () => {
  it("should use the atomic reservation path", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 51, windowStart }]);

    const count = await incrementDMCounter("account_123");

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(count).toBe(51);
  });
});
