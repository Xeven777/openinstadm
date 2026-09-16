import { getRedisConnection } from "@/lib/queue/client";

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
// Leave room for network latency at the end of the permitted window.
const SEND_MARGIN_MS = 60_000;

function windowKey(accountId: string, userId: string): string {
  return `ig:messaging-window:${JSON.stringify([accountId, userId])}`;
}

/** Record Meta's event time, never webhook arrival time. Duplicate/delayed
 * webhooks must not extend the window or overwrite a newer interaction. */
export async function recordMessagingInteraction(
  accountId: string,
  userId: string,
  timestamp: number,
): Promise<void> {
  const now = Date.now();
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 60_000) return;
  const interactionAt = Math.min(timestamp, now);
  const expiresAt = interactionAt + MESSAGING_WINDOW_MS;
  if (expiresAt <= now) return;
  await getRedisConnection().eval(
    `local previous = tonumber(redis.call('GET', KEYS[1]) or '0')
     if tonumber(ARGV[1]) > previous then
       redis.call('SET', KEYS[1], ARGV[1], 'PXAT', ARGV[2])
     end
     return 1`,
    1,
    windowKey(accountId, userId),
    interactionAt,
    expiresAt,
  );
}

export async function hasOpenMessagingWindow(accountId: string, userId: string): Promise<boolean> {
  const timestamp = Number(await getRedisConnection().get(windowKey(accountId, userId)));
  const age = Date.now() - timestamp;
  return timestamp > 0 && Number.isFinite(timestamp) && age >= 0 && age < MESSAGING_WINDOW_MS - SEND_MARGIN_MS;
}
