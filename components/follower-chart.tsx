"use client";

/**
 * Followers Over Time
 *
 * Single-series line chart over stored daily snapshots. Deliberately separate
 * from the Overview stat tiles: those sum the selected posts, while this is an
 * account-level total that ignores the post range.
 *
 * History depth is limited by what has been snapshotted — Instagram only serves
 * ~30 days of account insights, so earlier days exist only if this instance was
 * already running then.
 */

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface FollowerChartPoint {
  date: string;
  followers: number;
  delta: number | null;
}

const SERIES_COLOR = "var(--color-primary)";
const GRID_COLOR = "var(--color-muted)";

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatSigned(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FollowerChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded border border-border bg-muted px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{formatDay(point.date)}</p>
      <p className="mt-1 font-semibold text-foreground">
        {point.followers.toLocaleString()} followers
      </p>
      {point.delta !== null && point.delta !== 0 && (
        <p className={point.delta > 0 ? "text-success" : "text-destructive"}>
          {formatSigned(point.delta)} that day
        </p>
      )}
    </div>
  );
}

export default function FollowerChart({
  data,
  followers,
}: {
  data: FollowerChartPoint[];
  followers: number | null;
}) {
  const [showTable, setShowTable] = useState(false);

  const current = followers ?? data.at(-1)?.followers ?? null;

  // Net change across the whole visible window, shown once in the header rather
  // than labelling every point.
  const net =
    data.length > 1 ? data[data.length - 1].followers - data[0].followers : null;

  return (
    <Card size="sm">
      <CardContent className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Followers over time
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {current === null
                ? "Follower count unavailable"
                : `${current.toLocaleString()} now`}
              {net !== null && (
                <>
                  {" · "}
                  <span
                    className={net >= 0 ? "text-success" : "text-destructive"}
                  >
                    {formatSigned(net)}
                  </span>{" "}
                  over {data.length} days
                </>
              )}
            </p>
          </div>
          {data.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? "Show chart" : "Show table"}
            </Button>
          )}
        </div>

        {data.length < 2 ? (
          <div className="mt-6 rounded border border-border bg-muted/60 p-6 text-center">
            <p className="text-sm text-foreground">
              Collecting follower history
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.length === 0
                ? "No snapshots recorded yet."
                : "One day recorded so far."}{" "}
              A point is added daily — the chart appears once there are at least
              two.
            </p>
          </div>
        ) : showTable ? (
          <div className="mt-4 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium text-right">
                    Followers
                  </th>
                  <th className="py-2 pl-3 font-medium text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((p) => (
                  <tr
                    key={p.date}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 pr-4 text-foreground">
                      {formatDay(p.date)}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {p.followers.toLocaleString()}
                    </td>
                    <td className="py-2 pl-3 text-right text-muted-foreground">
                      {p.delta === null ? "—" : formatSigned(p.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke={GRID_COLOR}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fill: "white", fontSize: 12 }}
                  stroke={GRID_COLOR}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fill: "white", fontSize: 12 }}
                  stroke={GRID_COLOR}
                  tickLine={false}
                  width={52}
                  // Followers rarely start near zero, so a zero baseline would
                  // flatten the line into a straight edge.
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="followers"
                  stroke={SERIES_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: SERIES_COLOR,
                    stroke: "var(--color-background)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
