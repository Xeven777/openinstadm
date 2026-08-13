"use client";

/**
 * Settings — Team island
 *
 * The settings page is a Server Component; this island owns the team section's
 * interactivity (invite form, copy/revoke invite links). Mutations POST/DELETE
 * to the members API, then `router.refresh()` re-renders the Server Component
 * so the member/invitation list stays in sync with the server.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceMembersPayload } from "@/lib/server/members";

export default function SettingsTeam({
  members,
}: {
  members: WorkspaceMembersPayload;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);

  const canManageMembers =
    members.currentUserRole === "OWNER" || members.currentUserRole === "ADMIN";

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("invite");
    try {
      const res = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const payload = await res.json();
      if (payload.success) {
        setInviteEmail("");
        router.refresh();
      } else {
        setError(payload.error ?? "Could not invite member");
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeInvitation(invitationId: string) {
    setBusy(`invite:${invitationId}`);
    try {
      await fetch("/api/workspace/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card size="sm">
      <CardContent className="gap-0">
        <h2 className="text-base font-semibold mb-6">Team</h2>
      <div className="space-y-3">
        {members.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {member.user.name ?? member.user.email ?? "Unknown member"}
              </p>
              <p className="text-xs text-muted-foreground">
                {member.user.email}
              </p>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
              {member.role}
            </span>
          </div>
        ))}
      </div>

      {members.invitations.length ? (
        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Pending invites
          </p>
          <div className="space-y-3">
            {members.invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-3 rounded border border-border bg-muted/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {invitation.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invitation.role} · {invitation.inviteUrl}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard?.writeText(invitation.inviteUrl)
                    }
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void removeInvitation(invitation.id)}
                    disabled={busy === `invite:${invitation.id}`}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canManageMembers && (
        <form
          onSubmit={inviteMember}
          className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_140px_auto]"
        >
          <Input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="teammate@agency.com"
            required
          />
          <Select
            value={inviteRole}
            onValueChange={(value) =>
              setInviteRole((value ?? "MEMBER") as "ADMIN" | "MEMBER")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">Member</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={busy === "invite"}>
            {busy === "invite" ? "Inviting..." : "Invite"}
          </Button>
          {error && <p className="sm:col-span-3 text-sm text-error">{error}</p>}
        </form>
      )}
    </CardContent>
    </Card>
  );
}
