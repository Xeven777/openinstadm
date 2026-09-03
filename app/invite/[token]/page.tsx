import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import InvitationAcceptCard from "@/components/invitation-accept-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { cn } from "@/lib/utils";
import { normalizeInvitationEmail } from "@/lib/workspace-invitations";
const WORKSPACE_PERMISSION_LABELS = { MANAGE_AUTOMATIONS: "Manage automations", MANAGE_INSTAGRAM_ACCOUNTS: "Manage Instagram accounts", MANAGE_MEMBERS: "Manage team" } as const;
type WorkspacePermission = keyof typeof WORKSPACE_PERMISSION_LABELS;

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Accept Workspace Invitation - OpenInstaDM",
  robots: { index: false, follow: false },
};

export default function InvitePage({ params }: InvitePageProps) {
  return (
    // params + session + invitation lookup stream at request time.
    <Suspense fallback={<div className="min-h-screen" />}>
      <InviteContent params={params} />
    </Suspense>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-2xl font-semibold text-foreground transition-opacity hover:opacity-80"
          >
            OpenInstaDM
          </Link>
        </div>
        <Card>
          <CardContent className="gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}

function InviteHeading({
  workspaceName,
  email,
  permissions,
}: {
  workspaceName: string;
  email: string;
  permissions?: string[];
}) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace invitation
      </p>
      <h1 className="mt-2 text-xl font-semibold text-foreground">
        Join {workspaceName}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        You were invited as a Member for {email}.
      </p>
      {permissions && permissions.length > 0 && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Access includes: {permissions
            .map((permission) => WORKSPACE_PERMISSION_LABELS[permission as WorkspacePermission])
            .filter(Boolean)
            .join(", ")}.
        </p>
      )}
    </>
  );
}

async function InviteContent({ params }: InvitePageProps) {
  const { token } = await params;
  const [session, invitation] = await Promise.all([
    auth(),
    prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { name: true } },
      },
    }),
  ]);

  // Missing or revoked links get no content — don't leak workspace names.
  if (!invitation || invitation.status === "REVOKED") {
    notFound();
  }

  const signedInEmail = session?.user?.email ?? null;
  const emailMatches = Boolean(
    signedInEmail &&
      normalizeInvitationEmail(signedInEmail) === invitation.email
  );

  const expired = invitation.expiresAt <= new Date();
  // Land on an expired link: persist the state so the inviter's settings list
  // reflects it instead of a perpetually-pending invite.
  if (expired && invitation.status === "PENDING") {
    void prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
  }

  const workspaceName = invitation.workspace.name;

  // Already accepted — only the invitee sees this; anyone else gets a 404.
  if (invitation.status === "ACCEPTED") {
    if (!emailMatches) notFound();
    return (
      <InviteShell>
        <InviteHeading
          workspaceName={workspaceName}
          email={invitation.email}
          permissions={invitation.permissions}
        />
        <p className="text-sm text-muted-foreground">
          You&apos;re already a member of {workspaceName}. Head to the
          dashboard to get started.
        </p>
        <div>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-fit")}
          >
            Open dashboard
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (invitation.status === "EXPIRED" || expired) {
    return (
      <InviteShell>
        <InviteHeading
          workspaceName={workspaceName}
          email={invitation.email}
          permissions={invitation.permissions}
        />
        <p className="text-sm text-destructive">
          This invitation has expired. Ask the workspace owner to resend it
          from Settings → Team.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <InviteHeading
        workspaceName={workspaceName}
        email={invitation.email}
        permissions={invitation.permissions}
      />
      <div className="pt-1">
        <InvitationAcceptCard
          token={token}
          isSignedIn={Boolean(session?.user?.id)}
          invitedEmail={invitation.email}
          signedInEmail={signedInEmail}
          emailMatches={emailMatches}
          workspaceName={workspaceName}
        />
      </div>
    </InviteShell>
  );
}
