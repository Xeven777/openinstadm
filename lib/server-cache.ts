/**
 * Tiny in-process TTL cache for slow, read-heavy API responses.
 *
 * Lives per server instance (works on self-hosted Node and serverless alike);
 * entries live for seconds-to-minutes, so cross-instance staleness is a
 * non-issue. Use it for Meta Graph API-backed endpoints where the external
 * call dominates latency (e.g. /api/instagram/overview) — on a return visit
 * the route returns the cached envelope instead of making dozens of Meta calls.
 */

interface Entry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  // Opportunistically sweep expired entries so the map can't grow unbounded.
  if (store.size > 500) {
    const now = Date.now();
    for (const [candidateKey, entry] of store) {
      if (now > entry.expiresAt) store.delete(candidateKey);
    }
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Drop every entry whose key starts with `prefix`.
 *
 * For caches that back a mutation's read path (e.g. dashboard stats), callers
 * must invalidate after a write so the next navigation doesn't serve stale
 * data for the rest of the TTL window.
 */
export function clearCachedByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
