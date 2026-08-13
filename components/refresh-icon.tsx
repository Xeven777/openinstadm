/**
 * Small circular-arrow refresh glyph used by dashboard pages that offer a
 * manual "refetch from source" action. `className` lets callers spin it while
 * a refresh is in flight.
 */
import { ArrowsClockwise } from "@phosphor-icons/react";

export default function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <ArrowsClockwise
      weight="bold"
      aria-hidden="true"
      className={`h-4 w-4 ${className}`}
    />
  );
}
