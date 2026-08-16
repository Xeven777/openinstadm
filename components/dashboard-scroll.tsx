"use client";

import { createContext, useContext } from "react";

/**
 * Dashboard scroll context.
 *
 * The dashboard's only scroll surface is the `<main>` element owned by
 * `DashboardShell` (`flex-1 overflow-y-auto` in dashboard-shell.tsx) — the
 * window itself never scrolls on dashboard pages. Islands that virtualize
 * against that surface (e.g. the overview posts table/grid) read the element
 * through this context instead of reaching for a DOM selector, so the scroll
 * surface and its markup stay owned by the product layout.
 */

export interface DashboardScrollValue {
  /** Ref attached to the dashboard `<main>` scroll element. */
  scrollElementRef: React.RefObject<HTMLElement | null>;
}

const DashboardScrollContext = createContext<DashboardScrollValue | null>(null);

export function DashboardScrollProvider({
  value,
  children,
}: {
  value: DashboardScrollValue;
  children: React.ReactNode;
}) {
  return (
    <DashboardScrollContext.Provider value={value}>
      {children}
    </DashboardScrollContext.Provider>
  );
}

export function useDashboardScrollElement(): React.RefObject<HTMLElement | null> | null {
  return useContext(DashboardScrollContext)?.scrollElementRef ?? null;
}
