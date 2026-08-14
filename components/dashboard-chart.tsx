"use client";

/**
 * DashboardChart — 7-day DM activity, animated area chart.
 *
 * Recharts AreaChart with a primary-tinted gradient fill, hover crosshair and
 * a themed tooltip. Colors read from the theme tokens (CSS vars resolve in both
 * light and dark), matching the rest of the dashboard. Deliberately a separate
 * client component so the recharts bundle loads only when this region streams.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DashboardChartPoint {
  date: string;
  count: number;
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded border border-border bg-muted px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{point.date}</p>
      <p className="mt-0.5 text-muted-foreground">
        {point.count.toLocaleString()} DM
        {point.count === 1 ? "" : "s"} sent
      </p>
    </div>
  );
}

export default function DashboardChart({
  data,
}: {
  data: DashboardChartPoint[];
}) {
  const total = data.reduce((sum, day) => sum + day.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>DMs — Last 7 Days</CardTitle>
        <CardAction>
          <span className="text-xs text-muted-foreground">
            {total} total
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
            <defs>
              <linearGradient id="dm-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={30}
              allowDecimals={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#dm-area-fill)"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: "var(--color-background)",
                  strokeWidth: 2,
                }}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
