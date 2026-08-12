"use client";

/**
 * Diagnostics Refresh — interactive island
 *
 * The diagnostics page is a Server Component, so "refresh" is just re-rendering
 * it server-side: this button calls `router.refresh()`, which re-runs the
 * component's queries against Redis/Postgres and streams fresh data back.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function DiagnosticsRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="rounded border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-border-hover disabled:opacity-50"
    >
      {isPending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
