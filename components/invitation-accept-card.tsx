"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InvitationAcceptCardProps {
  token: string;
  isSignedIn: boolean;
  invitedEmail: string;
  /** Email of the current session, when signed in. */
  signedInEmail: string | null;
  /** Whether the session email matches the invited email (computed server-side). */
  emailMatches: boolean;
  workspaceName: string;
}

export default function InvitationAcceptCard({
  token,
  isSignedIn,
  invitedEmail,
  signedInEmail,
  emailMatches,
  workspaceName,
}: InvitationAcceptCardProps) {
  const router = useRouter();
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
      router.push("/dashboard");
      return;
    }
    setMessage(payload.error ?? "Could not accept invitation");
    setBusy(false);
  }

  if (!isSignedIn) {
    // Send the invitee through the magic-link flow and bring them back here,
    // so accepting is one click after they land.
    const callbackUrl = encodeURIComponent(`/invite/${token}`);
    return (
      <div className="space-y-3">
        <a
          href={`/login?callbackUrl=${callbackUrl}`}
          className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-fit")}
        >
          Sign in to accept
        </a>
        <p className="text-xs text-muted-foreground">
          We&apos;ll email you a magic link for {invitedEmail}, then bring you
          back here to accept.
        </p>
      </div>
    );
  }

  if (!emailMatches) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
          This invite is for{" "}
          <span className="font-medium">{invitedEmail}</span>, but you&apos;re
          signed in as <span className="font-medium">{signedInEmail}</span>.
          Sign out and sign in with the invited email to accept.
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void signOut({
              callbackUrl: `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`,
            })
          }
        >
          Sign out and use a different account
        </Button>
      </div>
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
        {busy ? "Accepting..." : `Accept invitation to ${workspaceName}`}
      </Button>
      {message && <p className="text-sm text-destructive">{message}</p>}
      <p className="text-xs text-muted-foreground">
        Signed in as {signedInEmail}.
      </p>
    </div>
  );
}
