"use client";

/**
 * Overview Range Select — interactive island
 *
 * The overview page is a Server Component, so the post-range picker lives in
 * the URL (`?count=`). On change it rewrites the URL (preserving the selected
 * account) which makes Next.js re-render the Server Component server-side.
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const COUNT_OPTIONS = [
  { value: "25", label: "Last 25" },
  { value: "50", label: "Last 50" },
  { value: "100", label: "Last 100" },
  { value: "all", label: "All time" },
];

interface OverviewRangeSelectProps {
  /** Raw `count` search param from the server render, if any. */
  value: string;
}

export default function OverviewRangeSelect({
  value,
}: OverviewRangeSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hand-crafted URLs (e.g. ?count=47) still render 47 posts; only the select's
  // display falls back to the nearest known option.
  const current = COUNT_OPTIONS.some((o) => o.value === value)
    ? value
    : "50";

  const handleChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "50") {
        params.delete("count");
      } else {
        params.set("count", next);
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [pathname, router, searchParams]
  );

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Range
      </span>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="border-0 bg-transparent py-2 pr-1 text-sm text-foreground outline-none"
      >
        {COUNT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
