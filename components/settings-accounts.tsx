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
import Link from "next/link";
import { gooeyToast } from "goey-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<InstagramAccountStat | null>(null);
  const canManage = canManageInstagramAccounts(useWorkspaceContext());

  async function disconnectInstagram(instagramAccountId: string) {
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
      setAccountToDisconnect(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const isDisconnecting =
    accountToDisconnect !== null &&
    busy === `disconnect:${accountToDisconnect.id}`;

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
              className="rounded-lg border border-border bg-muted/50 p-4 space-y-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    @{account.username}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Expires{" "}
                      {account.tokenExpiresAt
                        ? new Date(account.tokenExpiresAt).toLocaleDateString(
                            "en-IN",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )
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
                    onClick={() => setAccountToDisconnect(account)}
                    disabled={busy === `disconnect:${account.id}`}
                  >
                    {busy === `disconnect:${account.id}`
                      ? "Disconnecting..."
                      : "Disconnect"}
                  </Button>
                )}
              </div>
              <FallbackNotice />
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
            {accounts.length > 0
              ? "Connect another account"
              : "Connect Instagram"}
          </a>
        )}
      </CardContent>

      <Dialog
        open={accountToDisconnect !== null}
        onOpenChange={(open) => {
          if (!open && !isDisconnecting) setAccountToDisconnect(null);
        }}
      >
        <DialogContent showCloseButton={!isDisconnecting}>
          <DialogHeader>
            <DialogTitle>
              Disconnect @{accountToDisconnect?.username}?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes the data connected to this Instagram
              account. Reconnecting it later starts with an empty account.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground">
            <p className="font-medium text-destructive">This cannot be undone.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Campaigns for @{accountToDisconnect?.username}</li>
              <li>DM logs and dashboard metrics</li>
              <li>Tracked links, click analytics, and follower history</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountToDisconnect(null)}
              disabled={isDisconnecting}
            >
              Keep account
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (accountToDisconnect) {
                  void disconnectInstagram(accountToDisconnect.id);
                }
              }}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Delete account data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * DM auto-replies moved out of Settings into the dedicated
 * Inbox Automations studio (keyword → AI intent → catch-all).
 */
function FallbackNotice() {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">DM auto-replies</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Default replies now live in Inbox Automations — keyword rules, AI
        replies grounded by your knowledge textbox, and a catch-all.
      </p>
      <Link
        href="/inbox-automations"
        className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
      >
        Open Inbox Automations →
      </Link>
    </div>
  );
}
