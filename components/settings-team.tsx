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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

  function getInitials(name: string | null, email: string | null): string {
    if (name) {
      return name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  }

  return (
    <Card>
      <CardContent className="gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground">
            {members.members.length} member{members.members.length === 1 ? "" : "s"}
            {members.invitations.length > 0 &&
              ` · ${members.invitations.length} pending invite${members.invitations.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <Separator />

        <div className="space-y-1">
          {members.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {getInitials(member.user.name, member.user.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {member.user.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.user.email}
                </p>
              </div>
              <Badge
                variant={
                  member.role === "OWNER"
                    ? "default"
                    : member.role === "ADMIN"
                      ? "secondary"
                      : "outline"
                }
              >
                {member.role}
              </Badge>
            </div>
          ))}
        </div>

        {members.invitations.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pending invites
              </p>
              <div className="space-y-2">
                {members.invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {invitation.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invitation.role} · expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void navigator.clipboard?.writeText(
                            invitation.inviteUrl
                          )
                        }
                      >
                        Copy link
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
          </>
        )}

        {canManageMembers && (
          <>
            <Separator />
            <form
              onSubmit={inviteMember}
              className="grid gap-3 sm:grid-cols-7 sm:items-center"
            >
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@agency.com"
                required
                className="sm:col-span-4"
              />
              <Select
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole((value ?? "MEMBER") as "ADMIN" | "MEMBER")
                }
              >
                <SelectTrigger className="w-full sm:col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={busy === "invite"} className="">
                {busy === "invite" ? "Inviting..." : "Invite"}
              </Button>
              {error && (
                <p className="sm:col-span-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
