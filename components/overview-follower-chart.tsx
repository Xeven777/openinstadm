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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const FollowerChart = dynamic(() => import("@/components/follower-chart"), {
  ssr: false,
  loading: () => (
    <Card size="sm">
      <CardContent className="h-56 sm:h-64">
        <Skeleton className="h-full w-full" />
      </CardContent>
    </Card>
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
