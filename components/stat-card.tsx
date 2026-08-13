/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend. Wraps shadcn Card.
 */

import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ label, value, trend, trendUp }: StatCardProps) {
  return (
    <Card size="sm">
      <CardContent className="gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {trend && (
          <p className={`text-xs ${trendUp ? "text-success" : "text-destructive"}`}>
            {trendUp ? "Up" : "Down"} {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
