"use client";

/**
 * Settings — Instagram Connection island
 *
 * The settings page is a Server Component; this island owns the account list's
 * interactivity (disconnect confirm + busy state + inline errors). After a
 * successful disconnect it calls `router.refresh()` so the Server Component
 * re-renders without the account — no client fetch of the list itself.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "goey-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { InstagramAccountStat } from "@/lib/server/stats";
import { canManageInstagramAccounts, useWorkspaceContext } from "@/lib/workspace-context";

export default function SettingsAccounts({
  accounts,
}: {
  accounts: InstagramAccountStat[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageInstagramAccounts(useWorkspaceContext());

  async function disconnectInstagram(instagramAccountId: string) {
    if (
      !confirm(
        "Disconnect Instagram? Campaigns for this account will stop sending DMs."
      )
    ) {
      return;
    }

    setBusy(`disconnect:${instagramAccountId}`);
    setError(null);
    try {
      const res = await fetch("/api/instagram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId }),
      });
      const payload = await res.json().catch(() => null);

      if (!payload?.success) {
        setError(payload?.error ?? "Could not disconnect account");
        gooeyToast.error(payload?.error ?? "Could not disconnect account");
        return;
      }

      gooeyToast.success("Instagram account disconnected");

      // Re-render the server component: the account list, the sidebar shell,
      // and the dashboard stats cache (invalidated by the disconnect route)
      // all pick up the change.
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Instagram Connection
            </h2>
            <p className="text-sm text-muted-foreground">
              Webhooks and private replies depend on this connection.
            </p>
          </div>
          <Badge variant={accounts.length > 0 ? "success" : "warning"}>
            {accounts.length > 0 ? "Connected" : "Not connected"}
          </Badge>
        </div>

        <Separator />

        <div className="space-y-3">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {accounts.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Connect an Instagram professional account to launch campaigns.
            </p>
          )}

          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  @{account.username}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Expires{" "}
                    {account.tokenExpiresAt
                      ? new Date(account.tokenExpiresAt).toLocaleDateString()
                      : "unknown"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <Badge
                    variant={
                      account.webhookSubscribed ? "success" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {account.webhookSubscribed
                      ? "Webhook ready"
                      : "Webhook pending"}
                  </Badge>
                </div>
              </div>
              {canManage && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void disconnectInstagram(account.id)}
                  disabled={busy === `disconnect:${account.id}`}
                >
                  {busy === `disconnect:${account.id}`
                    ? "Disconnecting..."
                    : "Disconnect"}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Separator />

        {canManage && (
          <a
            href="/api/instagram/connect"
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-linear-to-tl w-fit from-fuchsia-500 via-red-600 to-orange-400 text-white ml-auto",
            )}
          >
            {accounts.length > 0 ? "Connect another account" : "Connect Instagram"}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
