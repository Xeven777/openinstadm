import { Suspense } from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { getPrimaryWorkspace } from "@/lib/workspace";

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

  // Fast path: just look up the membership (one indexed query). The full
  // ensureWorkspaceForUser (which also checks pending invitations) is only
  // needed at login time, not on every page navigation.
  const workspace = await getPrimaryWorkspace(session.user.id);
  if (!workspace) {
    redirect("/login");
  }

  const accounts = await prisma.instagramAccount.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { connectedAt: "desc" },
    select: { username: true },
  });

  return (
    <WorkspaceProvider
      value={{
        userId: session.user.id,
        workspaceId: workspace.id,
        role: "OWNER",
      }}
    >
      <DashboardShell
        workspaceName={workspace.name}
        instagramUsername={accounts[0]?.username ?? null}
        instagramAccountCount={accounts.length}
      >
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  );
}
