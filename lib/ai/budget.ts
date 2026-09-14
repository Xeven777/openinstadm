/**
 * Redis-backed hourly budget for AI calls, per workspace.
 *
 * Prevents runaway LLM spend on viral posts. Check before every AI call;
 * consume only when the call actually fires.
 */

import { getRedisConnection } from "@/lib/queue/client";
import { getAIBudgetPerHour } from "@/lib/env";

export async function checkAiBudget(workspaceId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const limit = getAIBudgetPerHour();
  try {
    const redis = getRedisConnection();
    const key = `ai:budget:${workspaceId}`;
    const raw = await redis.get(key);
    const used = raw ? Number(raw) || 0 : 0;
    return { allowed: used < limit, used, limit };
  } catch {
    // Redis down → fail open so DMs still flow (keyword/catch-all tiers work).
    return { allowed: true, used: 0, limit };
  }
}

export async function consumeAiBudget(workspaceId: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const key = `ai:budget:${workspaceId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600);
    }
  } catch {
    // Best effort only.
  }
}
