/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend. Wraps shadcn Card.
 * Pass an optional `icon` (a Phosphor icon element) to render a tinted chip in
 * the top-right corner.
 */

import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  icon?: React.ReactNode;
}

export default function StatCard({
  label,
  value,
  trend,
  trendUp,
  icon,
}: StatCardProps) {
  return (
    <Card size="sm">
      <CardContent className="gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {icon}
            </span>
          )}
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {trend && (
          <p className={`text-xs ${trendUp ? "text-success" : "text-destructive"}`}>
            {trendUp ? "Up" : "Down"} {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
