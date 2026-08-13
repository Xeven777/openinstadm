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
import { Button } from "@/components/ui/button";

export default function DiagnosticsRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
    >
      {isPending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
