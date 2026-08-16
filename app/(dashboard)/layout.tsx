import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { getSidebarAccounts } from "@/lib/server/settings";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { getUserWorkspaces } from "@/lib/workspace";

/**
 * Dashboard layout (Cache Components).
 *
 * The shell is gated on the session, so the auth + workspace queries live
 * behind a Suspense boundary: the frame streams in once they resolve, and the
 * page content (itself suspended in each page) streams after that. The fallback
 * matches the shell's outer frame so there is no layout jump while auth runs.
 *
 * The resolved workspace context is passed to pages via WorkspaceProvider so
 * they can skip their own auth() + workspace lookups — the layout already did
 * them.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex h-dvh bg-background" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Resolve the active workspace: the workspace_id cookie (set by the switch
  // route / invite acceptance) when it names a membership, else the oldest.
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null;
  const workspaces = await getUserWorkspaces(session.user.id);
  if (workspaces.length === 0) {
    redirect("/login");
  }
  const selected =
    workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ??
    workspaces[0];

  const { username: instagramUsername, count: instagramAccountCount } =
    await getSidebarAccounts(selected.id);

  return (
    <WorkspaceProvider
      value={{
        userId: session.user.id,
        workspaceId: selected.id,
        role: selected.role,
      }}
    >
      <DashboardShell
        workspaceName={selected.name}
        workspaceId={selected.id}
        workspaces={workspaces}
        instagramUsername={instagramUsername}
        instagramAccountCount={instagramAccountCount}
      >
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  );
}
