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

export const WORKSPACE_PERMISSION_LABELS = {
  MANAGE_AUTOMATIONS: "Manage automations",
  MANAGE_INSTAGRAM_ACCOUNTS: "Manage Instagram accounts",
  MANAGE_MEMBERS: "Manage team",
} as const;

export type WorkspacePermission = keyof typeof WORKSPACE_PERMISSION_LABELS;

export function isOwner(context: WorkspaceContextValue | null | undefined) {
  return context?.role === "OWNER";
}

function hasPermission(
  context: WorkspaceContextValue | null | undefined,
  permission: WorkspacePermission,
) {
  return Boolean(isOwner(context) || context?.permissions.includes(permission));
}

export function canManageAutomations(context: WorkspaceContextValue | null | undefined) {
  return hasPermission(context, "MANAGE_AUTOMATIONS");
}

export function canManageInstagramAccounts(context: WorkspaceContextValue | null | undefined) {
  return hasPermission(context, "MANAGE_INSTAGRAM_ACCOUNTS");
}

export function canManageMembers(context: WorkspaceContextValue | null | undefined) {
  return hasPermission(context, "MANAGE_MEMBERS");
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
