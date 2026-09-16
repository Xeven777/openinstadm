/**
 * Hourly budget for AI calls, per workspace.
 *
 * Prevents runaway LLM spend on viral posts. Check before every AI call;
 * consume only when the call actually fires.
 *
 * Backed by the same Postgres window counter as the DM rate limit
 * (`lib/db/window-counter.ts`) — the AI budget only measures, so it claims with
 * no cap and reads the window count.
 */

import { getAIBudgetPerHour } from "@/lib/env";
import { claimWindowSlot, readWindowCount } from "@/lib/db/window-counter";

const AI_BUDGET_WINDOW_SECONDS = 3600;
// Effectively uncapped: this counter exists to measure usage, not to limit it.
const NO_CAP = 2_147_483_647;

function budgetKey(workspaceId: string): string {
  return `ai:${workspaceId}`;
}

export async function checkAiBudget(workspaceId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const limit = getAIBudgetPerHour();
  try {
    const used = await readWindowCount(
      budgetKey(workspaceId),
      AI_BUDGET_WINDOW_SECONDS
    );
    return { allowed: used < limit, used, limit };
  } catch {
    // Counter unavailable → fail open so DMs still flow (keyword/catch-all
    // tiers work without AI).
    return { allowed: true, used: 0, limit };
  }
}

export async function consumeAiBudget(workspaceId: string): Promise<void> {
  try {
    await claimWindowSlot({
      key: budgetKey(workspaceId),
      windowSeconds: AI_BUDGET_WINDOW_SECONDS,
      max: NO_CAP,
    });
  } catch {
    // Best effort only.
  }
}
