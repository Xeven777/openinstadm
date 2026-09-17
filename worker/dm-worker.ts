import { config as loadEnv } from "dotenv";
loadEnv();

import { createDMWorker } from "@/lib/queue/dm-worker";
import { recordWorkerHeartbeat } from "@/lib/ops/worker-health";
import { reconcileComments } from "@/lib/polling/comment-reconciler";
import os from "node:os";

const worker = createDMWorker();
const startedAt = new Date().toISOString();
const HEARTBEAT_INTERVAL_MS = 30_000;
// Polling safety net for comments that webhooks miss. Runs in the worker because
// it must fire every few minutes and Vercel's free crons only run once a day.
//
// Neon pooled still needs a query-free window to autosuspend (default 5 min).
// 90 min halves the fixed sweep cost (~7 → ~5 CU-hours/month at 0.25 CU) while
// leaving a long idle window where Neon can suspend to 0 CU. Trade-off: a
// comment Meta's webhooks miss is now picked up up to 90 minutes late instead
// of 60. Polling covers comments only — DM inbox automations are webhook-only
// and never need this sweep.
const POLL_INTERVAL_MS = 90 * 60_000;
const POLL_DISABLED = false;

console.log(
  `[DM Worker] Started (poll=${POLL_DISABLED ? "disabled" : `${POLL_INTERVAL_MS / 60_000}min`}, heartbeat=30s)`
);

async function heartbeat() {
  try {
    await recordWorkerHeartbeat({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DM Worker] Heartbeat failed:", message);
  }
}

void heartbeat();
const heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);

let pollRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

async function poll() {
  if (POLL_DISABLED) return;
  if (pollRunning) {
    console.log("[DM Worker] Previous sweep still running, skipping");
    return;
  }
  pollRunning = true;
  try {
    await reconcileComments();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DM Worker] Comment reconciliation failed:", message);
  } finally {
    pollRunning = false;
    pollTimer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
  }
}

// Kick off one sweep shortly after boot (unless polling disabled).
if (!POLL_DISABLED) {
  setTimeout(() => void poll(), 10_000);
} else {
  console.log("[DM Worker] Comment polling disabled — webhook-only mode");
}

async function shutdown(signal: string) {
  console.log(`[DM Worker] ${signal} received, closing worker`);
  clearInterval(heartbeatTimer);
  if (pollTimer) clearTimeout(pollTimer);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
