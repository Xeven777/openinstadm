import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockWithDiagnosticsRedisConnection,
  mockGetDMQueueForDiagnostics,
  mockGetWorkerHealth,
  mockGetWorkerAlerts,
} = vi.hoisted(() => ({
  mockWithDiagnosticsRedisConnection: vi.fn(),
  mockGetDMQueueForDiagnostics: vi.fn(),
  mockGetWorkerHealth: vi.fn(),
  mockGetWorkerAlerts: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {},
}));

vi.mock("@/lib/queue/client", () => ({
  withDiagnosticsRedisConnection: mockWithDiagnosticsRedisConnection,
  getDMQueueForDiagnostics: mockGetDMQueueForDiagnostics,
}));

vi.mock("@/lib/ops/worker-health", () => ({
  getWorkerHealth: mockGetWorkerHealth,
  getWorkerAlerts: mockGetWorkerAlerts,
}));

import { getDiagnosticsOverview } from "../lib/server/diagnostics";

describe("getDiagnosticsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns usable diagnostics after a successful bounded Redis probe", async () => {
    const redis = {};
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 2,
        active: 1,
        delayed: 0,
        failed: 3,
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockWithDiagnosticsRedisConnection.mockImplementation(
      async (operation) => operation(redis),
    );
    mockGetDMQueueForDiagnostics.mockReturnValue(queue);
    mockGetWorkerHealth.mockResolvedValue({
      healthy: true,
      heartbeat: { checkedAt: "2026-09-08T00:00:00.000Z" },
      ageMs: 1_000,
    });
    mockGetWorkerAlerts.mockResolvedValue([]);

    await expect(getDiagnosticsOverview()).resolves.toMatchObject({
      queueCounts: { waiting: 2, active: 1, delayed: 0, failed: 3 },
      redisAvailable: true,
      redisError: null,
    });
    expect(queue.close).toHaveBeenCalledOnce();
  });

  it("returns a degraded result when Redis cannot be reached", async () => {
    mockWithDiagnosticsRedisConnection.mockRejectedValue(
      new Error("connection refused"),
    );

    await expect(getDiagnosticsOverview()).resolves.toEqual({
      queueCounts: null,
      workerHealth: { healthy: false, heartbeat: null, ageMs: null },
      workerAlerts: [],
      redisAvailable: false,
      redisError: "Redis is unavailable.",
    });
  });
});
