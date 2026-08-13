"use client";

/**
 * TanStack Query provider for the dashboard's client islands.
 *
 * Persists the whole query cache in IndexedDB (see lib/query/indexeddb.ts) so a
 * same-browser revisit restores cached client data instantly and revalidates in
 * the background — the IndexedDB replacement for the old sessionStorage-backed
 * `useCachedFetch` (lib/client-cache.ts).
 */

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIndexedDbPersister } from "@/lib/query/indexeddb";

// How long a persisted cache entry stays usable before the persister discards
// it on restore. Long enough to make revisits feel instant, short enough that
// a stale cache never lingers across days.
const PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h
// Bump to invalidate all previously persisted caches (breaking shape change).
const PERSIST_BUSTER = "1";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 1000 * 60 * 60 * 24,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  const [persister] = useState(() => createIndexedDbPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE_MS,
        buster: PERSIST_BUSTER,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
