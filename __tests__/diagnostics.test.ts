import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetRunnerQueueCounts,
  mockIsRunnerConfigured,
  mockGetWorkerHealth,
  mockGetWorkerAlerts,
} = vi.hoisted(() => ({
  mockGetRunnerQueueCounts: vi.fn(),
  mockIsRunnerConfigured: vi.fn(),
  mockGetWorkerHealth: vi.fn(),
  mockGetWorkerAlerts: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {},
}));

vi.mock("@/lib/jobs/runner-stats", () => ({
  getRunnerQueueCounts: mockGetRunnerQueueCounts,
  isRunnerConfigured: mockIsRunnerConfigured,
}));

vi.mock("@/lib/ops/worker-health", () => ({
  getWorkerHealth: mockGetWorkerHealth,
  getWorkerAlerts: mockGetWorkerAlerts,
}));

import { getDiagnosticsOverview } from "../lib/server/diagnostics";

const runnerCounts = { waiting: 2, active: 1, delayed: 0, failed: 3 };
const healthyHeartbeat = {
  healthy: true,
  heartbeat: { checkedAt: "2026-09-08T00:00:00.000Z" },
  ageMs: 1_000,
};

describe("getDiagnosticsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkerHealth.mockResolvedValue(healthyHeartbeat);
    mockGetWorkerAlerts.mockResolvedValue([]);
  });

  it("returns runner counts and worker state when both sources answer", async () => {
    mockGetRunnerQueueCounts.mockResolvedValue(runnerCounts);

    await expect(getDiagnosticsOverview()).resolves.toMatchObject({
      queueCounts: runnerCounts,
      runnerAvailable: true,
      runnerError: null,
      workerHealth: { healthy: true },
      workerAlerts: [],
    });
  });

  it("degrades the queue tiles when the runner API fails", async () => {
    mockIsRunnerConfigured.mockReturnValue(true);
    mockGetRunnerQueueCounts.mockRejectedValue(new Error("401 Unauthorized"));

    await expect(getDiagnosticsOverview()).resolves.toMatchObject({
      queueCounts: null,
      runnerAvailable: false,
      runnerError: "The job runner is unreachable.",
      workerHealth: { healthy: true },
    });
  });

  it("explains a missing runner key instead of blaming the connection", async () => {
    mockIsRunnerConfigured.mockReturnValue(false);
    mockGetRunnerQueueCounts.mockRejectedValue(new Error("no key"));

    await expect(getDiagnosticsOverview()).resolves.toMatchObject({
      queueCounts: null,
      runnerError:
        "TRIGGER_SECRET_KEY is not set, so run counts are unavailable.",
    });
  });

  it("reports job activity as unhealthy when nothing has run", async () => {
    mockGetRunnerQueueCounts.mockResolvedValue(runnerCounts);
    mockGetWorkerHealth.mockResolvedValue({
      healthy: false,
      heartbeat: null,
      ageMs: null,
    });

    await expect(getDiagnosticsOverview()).resolves.toMatchObject({
      workerHealth: { healthy: false, ageMs: null },
      runnerAvailable: true,
    });
  });
});
