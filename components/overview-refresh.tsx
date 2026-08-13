"use client";

/**
 * Overview Refresh — interactive island
 *
 * The overview page is a Server Component reading from a Postgres snapshot, so
 * "refresh from Instagram" is: hit the overview API with `refresh=true` (which
 * bypasses the snapshot, refetches Meta, and re-upserts the snapshot), then
 * re-render the Server Component via `router.refresh()`.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import RefreshIcon from "@/components/refresh-icon";

interface OverviewRefreshProps {
  selectedAccountId: string;
  count: "all" | number;
}

export default function OverviewRefresh({
  selectedAccountId,
  count,
}: OverviewRefreshProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }
      params.set("count", String(count));
      params.set("refresh", "true");

      const res = await fetch(`/api/instagram/overview?${params}`);
      // Only re-render on success — a failed refetch would just paint the same
      // snapshot back, and the button state must not imply fresh data.
      if (res.ok) router.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleRefresh()}
      disabled={refreshing}
      title="Refresh from Instagram"
      aria-label="Refresh from Instagram"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:border-border-hover hover:text-foreground disabled:opacity-50"
    >
      <RefreshIcon className={refreshing ? "animate-spin" : ""} />
    </button>
  );
}
