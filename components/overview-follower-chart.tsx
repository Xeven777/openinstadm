"use client";

/**
 * Overview Follower Chart — interactive island
 *
 * The overview page is a Server Component, but recharts is heavy (~100KB+
 * gzip), so the chart stays behind a `next/dynamic` boundary inside this small
 * client island. The RSC passes the snapshot-backed series down as props.
 */

import dynamic from "next/dynamic";
import type { FollowerHistoryPoint } from "@/lib/reports/follower-history";

const FollowerChart = dynamic(() => import("@/components/follower-chart"), {
  ssr: false,
  loading: () => (
    <div className="panel rounded p-4 sm:p-6 h-56 sm:h-64 animate-pulse bg-surface-hover/40" />
  ),
});

export default function OverviewFollowerChart({
  data,
  followers,
}: {
  data: FollowerHistoryPoint[];
  followers: number | null;
}) {
  return <FollowerChart data={data} followers={followers} />;
}
