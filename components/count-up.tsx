"use client";

/**
 * CountUp — animates a number from its current value to the new one.
 *
 * Tiny rAF-based counter (no animation lib): eases out cubic so the number
 * decelerates into place. On first mount it counts up from 0; when the value
 * changes (e.g. switching accounts) it animates from the currently displayed
 * value instead of snapping. Honors prefers-reduced-motion by rendering the
 * final value immediately.
 */

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  /** Decimal places to keep (for percentages etc.). Defaults to 0. */
  decimals?: number;
  duration?: number;
}

export default function CountUp({
  value,
  decimals = 0,
  duration = 600,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  // Last value that was actually shown, so a value change animates from where
  // the counter currently is rather than restarting from zero.
  const shownRef = useRef(0);

  useEffect(() => {
    let raf = 0;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Schedule the visual update after commit instead of synchronously
      // triggering another render from the effect body.
      raf = requestAnimationFrame(() => {
        shownRef.current = value;
        setDisplay(value);
      });
      return () => cancelAnimationFrame(raf);
    }

    const from = shownRef.current;
    if (from === value) return;
    const start = performance.now();
    const factor = Math.pow(10, decimals);

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = Math.round((from + (value - from) * eased) * factor) / factor;
      shownRef.current = current;
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        shownRef.current = value;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, duration]);

  return <>{display.toFixed(decimals)}</>;
}
