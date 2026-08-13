/**
 * Status label for DM status. Rendered as a shadcn Badge; the variant carries
 * the state.
 */

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { variant: "success" | "warning" | "muted" | "destructive"; label: string }> = {
  SENT: { variant: "success", label: "Sent" },
  FAILED: { variant: "destructive", label: "Failed" },
  PENDING: { variant: "warning", label: "Pending" },
  SKIPPED_DEDUP: { variant: "muted", label: "Dedup" },
  SKIPPED_RATE_LIMIT: { variant: "warning", label: "Rate limited" },
  SKIPPED_PLAN_LIMIT: { variant: "warning", label: "Skipped" },
  SKIPPED_NO_MATCH: { variant: "muted", label: "No match" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.PENDING;

  return (
    <Badge variant={config.variant} className="shrink-0 whitespace-nowrap">
      {config.label}
    </Badge>
  );
}
