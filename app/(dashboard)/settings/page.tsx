/**
 * Settings Page (Server Component)
 *
 * Workspace name, connected Instagram accounts, team members, and usage are all
 * rendered directly from the database — no client fetch, no JSON round-trip.
 * Interactivity lives in two islands: `SettingsAccounts` (disconnect buttons)
 * and `SettingsTeam` (invite form, copy/revoke invite links). Mutations end in
 * `router.refresh()`, which re-runs this component's queries, so the page and
 * the sidebar shell always agree with the server.
 *
 * Layout is a bento grid on desktop: Profile + Instagram side by side,
 * full-width Team table, then Usage + Help side by side.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import SettingsAccounts from "@/components/settings-accounts";
import SettingsProfile from "@/components/settings-profile";
import SettingsTeam from "@/components/settings-team";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { getWorkspaceMembers } from "@/lib/server/members";
import { getSettingsData } from "@/lib/server/settings";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { prisma } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-10">
      {/* Surfaces the ?instagram= code the OAuth routes redirect back with.
          Needs a Suspense boundary: useSearchParams in a prerendered client
          page fails the production build without one. */}
      <Suspense fallback={null}>
        <InstagramConnectNotice />
      </Suspense>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, connections, team and more.
        </p>
      </div>

      {/* The session lookup + workspace/accounts/members reads stream inside
          this boundary under cacheComponents. */}
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-4 h-20 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-4 h-32 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <Skeleton className="h-6 w-16" />
          <Skeleton className="mt-4 h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

async function SettingsContent() {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");

  const [settings, members, user] = await Promise.all([
    getSettingsData(context.workspaceId),
    getWorkspaceMembers(
      context.workspaceId,
      context.role,
      context.permissions
    ),
    prisma.user.findUnique({
      where: { id: context.userId },
      select: { name: true, email: true },
    }),
  ]);

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SettingsAccounts accounts={settings.instagramAccounts} />
        <SettingsProfile
          userName={user?.name ?? null}
          userEmail={user?.email ?? null}
          userRole={context.role}
        />
      </div>

      <SettingsTeam members={members} currentUserId={context.userId} />

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Usage</h2>
              <p className="text-sm text-muted-foreground">
                Self-hosted with no plan limits.
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  DMs sent this month
                </p>
                <p className="text-xs text-muted-foreground">
                  Resets on the first of each month.
                </p>
              </div>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {settings.workspace?.dmsSentThisPeriod ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Need help?
              </h2>
              <p className="text-sm text-muted-foreground">
                Check the docs or report an issue on GitHub.
              </p>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <a
                href="/docs"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                View documentation
              </a>
              <a
                href="https://github.com/Xeven777/openinstadm/issues"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Report a bug
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
