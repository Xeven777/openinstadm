import { defineConfig } from "@trigger.dev/sdk";
import { DM_TASK_RETRY } from "./lib/jobs/types";

/**
 * Trigger.dev project configuration.
 *
 * This file belongs to the job runner, not to the web app: `next build` never
 * reads it. The CLI (`bunx trigger.dev dev` / `deploy`) does.
 *
 * `TRIGGER_PROJECT_REF` comes from the Trigger.dev dashboard (Project settings
 * → API keys). The secret key (`TRIGGER_SECRET_KEY`) is what the web app uses
 * to trigger runs and is required in the Vercel environment.
 */
const project = process.env.TRIGGER_PROJECT_REF;

if (!project) {
  throw new Error(
    "TRIGGER_PROJECT_REF is required. Create a project at https://trigger.dev, then set TRIGGER_PROJECT_REF (proj_...) and TRIGGER_SECRET_KEY in your environment."
  );
}

export default defineConfig({
  project,
  dirs: ["./trigger"],
  // DM jobs are short (Meta calls plus, at most, one 15s LLM call). 5 minutes
  // is well clear of that while still capping a wedged run.
  maxDuration: 300,
  retries: {
    // Three attempts at 5m → 15m → 45m for every task; individual tasks can
    // override via their own `retry` option.
    default: DM_TASK_RETRY,
    // Don't retry while developing; a retry loop over a 5 minute backoff makes
    // `trigger dev` unusable.
    enabledInDev: false,
  },
  // The handlers log the full DM decision path with console.log. Keep that
  // visible in `trigger dev` instead of only in the dashboard.
  enableConsoleLogging: true,
});
