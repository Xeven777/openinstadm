/**
 * Settings Page (Server Component)
 *
 * Workspace name, connected Instagram accounts, team members, and usage are all
 * rendered directly from the database — no client fetch, no JSON round-trip.
 * Interactivity lives in two islands: `SettingsAccounts` (disconnect buttons)
 * and `SettingsTeam` (invite form, copy/revoke invite links). Mutations end in
 * `router.refresh()`, which re-runs this component's queries, so the page and
 * the sidebar shell always agree with the server.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import SettingsAccounts from "@/components/settings-accounts";
import SettingsTeam from "@/components/settings-team";
import { getWorkspaceMembers } from "@/lib/server/members";
import { getSettingsData } from "@/lib/server/settings";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Surfaces the ?instagram= code the OAuth routes redirect back with.
          Needs a Suspense boundary: useSearchParams in a prerendered client
          page fails the production build without one. */}
      <Suspense fallback={null}>
        <InstagramConnectNotice />
      </Suspense>

      {/* The session lookup + workspace/accounts/members reads stream inside
          this boundary under cacheComponents. */}
      <Suspense fallback={<div className="bg-muted rounded p-8 h-64" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");

  const [settings, members] = await Promise.all([
    getSettingsData(context.workspaceId),
    getWorkspaceMembers(context.workspaceId, context.role),
  ]);

  return (
    <>
      <SettingsAccounts accounts={settings.instagramAccounts} />

      <SettingsTeam members={members} />

      <section className="bg-muted rounded p-4 sm:p-6">
        <h2 className="text-base font-semibold mb-6">Usage</h2>
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              DMs sent this month
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Self-hosted — no plan limits.
            </p>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {settings.workspace?.dmsSentThisPeriod ?? 0}
          </span>
        </div>
      </section>
    </>
  );
}
