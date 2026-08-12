"use client";

/**
 * Tiny stale-while-revalidate cache backed by sessionStorage.
 *
 * Instagram API calls (profile picture, the post library) are slow, so we show
 * the last cached copy instantly and refresh in the background. Cache lives for
 * the browser tab session; entries older than the caller's max age are treated
 * as stale (still shown, but the caller should revalidate).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Entry<T> {
  data: T;
  ts: number;
}

export function readCache<T>(
  key: string,
  maxAgeMs: number
): { data: T | null; stale: boolean } {
  if (typeof window === "undefined") return { data: null, stale: true };
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return { data: null, stale: true };
    const entry = JSON.parse(raw) as Entry<T>;
    return { data: entry.data, stale: Date.now() - entry.ts > maxAgeMs };
  } catch {
    return { data: null, stale: true };
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}

export interface CachedFetchState<T> {
  /** The freshest data we have for the current key, or null while loading. */
  data: T | null;
  /** True only when there is nothing cached to show yet (first load). */
  loading: boolean;
  error: string | null;
  /**
   * Force a background refetch (e.g. after a mutation or a manual Refresh).
   * Pass `true` to bypass any server-side snapshot cache — the flag is passed
   * through to the fetcher so it can request a fresh read from the source.
   */
  refresh: (bypass?: boolean) => void;
}

/**
 * Stale-while-revalidate fetch for dashboard pages.
 *
 * On mount (and whenever `cacheKey` changes) the cached copy from
 * sessionStorage is painted instantly — no loading skeleton — while a fresh
 * fetch runs in the background and overwrites the cache. When there is no
 * cached copy, `loading` is true so pages can show their skeleton.
 *
 * `fetcher` is captured via a ref so pages can build it inline from filter
 * state without re-triggering the effect; changing filters should change
 * `cacheKey` instead (filters belong in the key). It receives a `bypass`
 * flag (true only for manual refreshes that should skip server-side caches).
 */
export function useCachedFetch<T>(
  cacheKey: string | null,
  fetcher: (bypass?: boolean) => Promise<T>,
  { maxAgeMs }: { maxAgeMs: number }
): CachedFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Keep the latest fetcher around without making it an effect dependency
  // (pages recreate it every render from filter state).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Which key the current `data` belongs to. Data is only exposed when it
  // matches the active key, so switching filters never flashes the previous
  // filter's data for even one frame.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Set when the caller asks for a bypassing refresh; consumed (and cleared)
  // once by the next run so it stays a one-shot flag.
  const bypassRef = useRef(false);
  const refresh = useCallback((bypass = false) => {
    bypassRef.current = bypass;
    setTick((t) => t + 1);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!cacheKey) {
      setData(null);
      setLoading(true);
      setLoadedKey(null);
      return;
    }
    let cancelled = false;
    const key = cacheKey;

    // Paint the cached copy instantly (loading stays false so no skeleton
    // flashes), then revalidate in the background below.
    const cached = readCache<T>(key, maxAgeMs);
    if (cached.data !== null) {
      setData(cached.data);
      setError(null);
      setLoading(false);
      setLoadedKey(key);
    } else {
      setData(null);
      setError(null);
      setLoading(true);
    }

    const run = async () => {
      const bypass = bypassRef.current;
      bypassRef.current = false;
      try {
        const fresh = await fetcherRef.current(bypass);
        if (cancelled) return;
        setData(fresh);
        setError(null);
        setLoading(false);
        setLoadedKey(key);
        writeCache(key, fresh);
      } catch (err) {
        if (cancelled) return;
        // Keep whatever was cached; only surface the error when there is
        // nothing to show at all.
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, maxAgeMs, tick]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const visibleData = useMemo(
    () => (loadedKey === cacheKey ? data : null),
    [loadedKey, cacheKey, data]
  );

  return { data: visibleData, loading, error, refresh };
}
