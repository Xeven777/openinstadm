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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InstagramAccountStat } from "@/lib/server/stats";

export default function SettingsAccounts({
  accounts,
}: {
  accounts: InstagramAccountStat[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        return;
      }

      // Re-render the server component: the account list, the sidebar shell,
      // and the dashboard stats cache (invalidated by the disconnect route)
      // all pick up the change.
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card size="sm">
      <CardContent className="gap-0">
        <h2 className="text-base font-semibold mb-6">Instagram Connection</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Status</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comment webhooks and private replies depend on this connection.
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              accounts.length > 0
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            {accounts.length > 0 ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Accounts</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {accounts.length} connected Instagram profile
              {accounts.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {accounts.length > 0 ? `${accounts.length} connected` : "None"}
          </span>
        </div>

        <div className="space-y-3 py-3">
          {error && <p className="text-sm text-error">{error}</p>}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Connect an Instagram professional account to launch campaigns.
            </p>
          )}
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-3 rounded border border-border bg-muted/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  @{account.username}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Token expires{" "}
                  {account.tokenExpiresAt
                    ? new Date(account.tokenExpiresAt).toLocaleDateString()
                    : "not available"}{" "}
                  ·{" "}
                  {account.webhookSubscribed
                    ? "Webhook ready"
                    : "Webhook pending"}
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => void disconnectInstagram(account.id)}
                disabled={busy === `disconnect:${account.id}`}
              >
                {busy === `disconnect:${account.id}`
                  ? "Disconnecting..."
                  : "Disconnect"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-border flex gap-3">
        <a
          href="/api/instagram/connect"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          {accounts.length > 0
            ? "Connect another account"
            : "Connect Instagram"}
        </a>
      </div>
    </CardContent>
    </Card>
  );
}
