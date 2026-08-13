"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InvitationAcceptCardProps {
  token: string;
  isSignedIn: boolean;
  invitedEmail: string;
}

export default function InvitationAcceptCard({
  token,
  isSignedIn,
  invitedEmail,
}: InvitationAcceptCardProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function acceptInvite() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/workspace/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();
    if (payload.success) {
      window.location.assign("/dashboard");
      return;
    }
    setMessage(payload.error ?? "Could not accept invitation");
    setBusy(false);
  }

  if (!isSignedIn) {
    return (
      <a
        href="/login"
        className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-fit")}
      >
        Sign in to accept
      </a>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={acceptInvite}
        disabled={busy}
        size="lg"
        className="w-fit"
      >
        {busy ? "Accepting..." : "Accept invitation"}
      </Button>
      {message && <p className="text-sm text-destructive">{message}</p>}
      <p className="text-xs text-muted-foreground">
        Use the magic link account for {invitedEmail}.
      </p>
    </div>
  );
}
