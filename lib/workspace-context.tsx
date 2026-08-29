"use client";

/**
 * Workspace context for dashboard pages.
 *
 * The layout already resolves the session + workspace on every navigation.
 * Pages need the same workspaceId/userId/role to gate queries and mutations.
 * Instead of each page calling `getCurrentWorkspaceContext()` (which re-runs
 * auth() + DB queries), the layout passes the resolved context through this
 * provider so pages can read it synchronously with `useWorkspaceContext()`.
 */

import { createContext, useContext } from "react";

export interface WorkspaceContextValue {
  userId: string;
  workspaceId: string;
  role: string;
  permissions: string[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Read the workspace context resolved by the layout. Returns null only if the
 * provider is missing (should never happen inside the dashboard).
 */
export function useWorkspaceContext(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
