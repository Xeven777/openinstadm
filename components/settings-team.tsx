"use client";

/**
 * Settings — Team island
 *
 * The settings page is a Server Component; this island owns the team section's
 * interactivity (invite form, permission changes, member removal, leave workspace,
 * copy/resent/revoke invite links). Mutations POST/PATCH/DELETE to the members
 * API, then `router.refresh()` re-renders the Server Component so the
 * member/invitation list stays in sync with the server. Every action surfaces
 * goey-toast feedback.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "goey-toast";
import { SignOut, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { WorkspaceMembersPayload } from "@/lib/server/members";
import {
  WORKSPACE_PERMISSION_LABELS,
  type WorkspacePermission,
} from "@/lib/workspace-context";
import Image from "next/image";

const PERMISSIONS = (Object.keys(WORKSPACE_PERMISSION_LABELS) as WorkspacePermission[]).map(
  (value) => ({ value, label: WORKSPACE_PERMISSION_LABELS[value] }),
);

type MemberPermission = WorkspacePermission;

function memberName(name: string | null, email: string | null): string {
  return name || email || "This member";
}

export default function SettingsTeam({
  members,
  currentUserId,
}: {
  members: WorkspaceMembersPayload;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<MemberPermission[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canManageMembers =
    members.currentUserRole === "OWNER" ||
    members.currentUserPermissions.includes("MANAGE_MEMBERS");
  const canGrantPermissions = members.currentUserRole === "OWNER";
  const pendingInvites = members.invitations.filter(
    (invitation) => invitation.status === "PENDING"
  ).length;

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("invite");
    try {
      const res = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, permissions: invitePermissions }),
      });
      const payload = await res.json();
      if (payload.success) {
        const email = inviteEmail.trim().toLowerCase();
        setInviteEmail("");
        setInvitePermissions([]);
        if (payload.addedExistingMember) {
          gooeyToast.success(`${email} added to the workspace`, {
            description: payload.emailSent
              ? "We've emailed them a sign-in link."
              : "Email couldn't be sent — they can sign in as usual.",
          });
        } else if (payload.emailSent) {
          gooeyToast.success(`Invite sent to ${email}`, {
            description: "They'll get an email with an accept link.",
          });
        } else {
          gooeyToast.warning(`Invite created for ${email}`, {
            description: "Email delivery failed — use Copy link to share it.",
          });
        }
        router.refresh();
      } else {
        setError(payload.error ?? "Could not invite member");
        if (res.status === 409) {
          gooeyToast.warning(payload.error ?? "This user is already a member");
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function updatePermissions(
    memberId: string,
    permissions: MemberPermission[]
  ) {
    setBusy(`permissions:${memberId}`);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, permissions }),
      });
      const payload = await res.json();
      if (payload.success) {
        gooeyToast.success("Member permissions updated");
        router.refresh();
      } else {
        gooeyToast.error(payload.error ?? "Could not update permissions");
      }
    } finally {
      setBusy(null);
    }
  }

  function togglePermission(
    permissions: MemberPermission[],
    permission: MemberPermission,
    checked: boolean
  ) {
    return checked
      ? [...permissions, permission]
      : permissions.filter((value) => value !== permission);
  }

  function permissionSummary(permissions: MemberPermission[]) {
    if (permissions.length === 0) return "Standard member access";
    return PERMISSIONS.filter((permission) => permissions.includes(permission.value))
      .map((permission) => permission.label)
      .join(" · ");
  }

  async function removeMember(memberId: string, displayName: string) {
    setBusy(`member:${memberId}`);
    setConfirmRemoveId(null);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const payload = await res.json();
      if (payload.success) {
        gooeyToast.success(`${displayName} removed from the workspace`);
        router.refresh();
      } else {
        gooeyToast.error(payload.error ?? "Could not remove member");
      }
    } finally {
      setBusy(null);
    }
  }

  async function leaveWorkspace(memberId: string) {
    setBusy("leave");
    setConfirmLeave(false);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const payload = await res.json();
      if (payload.success) {
        gooeyToast.success("You left the workspace");
        router.push("/dashboard");
      } else {
        gooeyToast.error(payload.error ?? "Could not leave workspace");
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeInvitation(invitationId: string, email: string) {
    setBusy(`invite:${invitationId}`);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const payload = await res.json();
      if (payload.success) {
        gooeyToast.success(`Invite for ${email} revoked`);
        router.refresh();
      } else {
        gooeyToast.error(payload.error ?? "Could not revoke invite");
      }
    } finally {
      setBusy(null);
    }
  }

  async function resendInvitation(invitationId: string, email: string) {
    setBusy(`invite:${invitationId}`);
    try {
      const res = await fetch("/api/workspace/invitations/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const payload = await res.json();
      if (payload.success) {
        gooeyToast.success(`Invite resent to ${email}`, {
          description: payload.emailSent
            ? "Check their inbox for a fresh accept link."
            : "Email delivery failed — use Copy link to share it.",
        });
        router.refresh();
      } else {
        gooeyToast.error(payload.error ?? "Could not resend invite");
      }
    } finally {
      setBusy(null);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      gooeyToast.success("Invite link copied", {
        description: "Share it with the invitee.",
      });
    } catch {
      gooeyToast.error("Could not copy link");
    }
  }

  return (
    <Card>
      <CardContent className="gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground">
            {members.members.length} member{members.members.length === 1 ? "" : "s"}
            {pendingInvites > 0 &&
              ` · ${pendingInvites} pending invite${pendingInvites === 1 ? "" : "s"}`}
          </p>
        </div>

        <Separator />

        {members.currentUserRole !== "OWNER" && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your access
            </p>
            <p className="mt-1 text-sm text-foreground">
              {members.currentUserPermissions.length === 0
                ? "Standard member access"
                : members.currentUserPermissions
                    .map((permission) => WORKSPACE_PERMISSION_LABELS[permission as WorkspacePermission])
                    .join(" · ")}
            </p>
          </div>
        )}

        {members.currentUserRole !== "OWNER" && <Separator />}

        <div className="space-y-1">
          {members.members.map((member) => {
            const isSelf = member.user.id === currentUserId;
            const isOwner = member.role === "OWNER";
            const isConfirming = confirmRemoveId === member.id;
            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      "https://api.dicebear.com/10.x/thumbs/svg?seed=" +
                      member.user.id
                    }
                    alt={member.user.name ?? member.user.email ?? "M"}
                    width={36}
                    height={36}
                    className="rounded-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.user.name ?? member.user.email}
                    {isSelf && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
                <Badge variant={isOwner ? "default" : "outline"}>
                  {member.role}
                </Badge>

                {!isOwner && canManageMembers && !isSelf && (
                  <>
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            void removeMember(
                              member.id,
                              memberName(member.user.name, member.user.email),
                            )
                          }
                          disabled={busy === `member:${member.id}`}
                        >
                          Remove
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirmRemoveId(member.id);
                          window.setTimeout(
                            () =>
                              setConfirmRemoveId((cur) =>
                                cur === member.id ? null : cur,
                              ),
                            4000,
                          );
                        }}
                        aria-label={`Remove ${member.user.email ?? member.user.name ?? "member"}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash />
                      </Button>
                    )}
                  </>
                )}

                {!isOwner && canGrantPermissions && (
                  <div className="w-full space-y-2 border-t border-border/60 pt-3 sm:ml-12">
                    <p className="text-xs font-medium text-muted-foreground">
                      Permissions
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {PERMISSIONS.map((permission) => (
                        <label
                          key={permission.value}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Switch
                            size="sm"
                            checked={member.permissions.includes(
                              permission.value,
                            )}
                            onCheckedChange={(checked) =>
                              void updatePermissions(
                                member.id,
                                togglePermission(
                                  member.permissions,
                                  permission.value,
                                  checked,
                                ),
                              )
                            }
                            disabled={busy === `permissions:${member.id}`}
                            aria-label={`${permission.label} for ${member.user.email ?? member.user.name ?? "member"}`}
                          />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {isSelf &&
                  !isOwner &&
                  (confirmLeave ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void leaveWorkspace(member.id)}
                        disabled={busy === "leave"}
                      >
                        Confirm leave
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmLeave(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmLeave(true)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <SignOut className="size-3.5" />
                      Leave workspace
                    </Button>
                  ))}
              </div>
            );
          })}
        </div>

        {canManageMembers && members.invitations.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Invites
              </p>
              <div className="space-y-2">
                {members.invitations.map((invitation) => {
                  const expired = invitation.status === "EXPIRED";
                  return (
                    <div
                      key={invitation.id}
                      className={`flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between ${
                        expired ? "opacity-60" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {invitation.email}
                          </p>
                          {expired && (
                            <Badge variant="warning" className="shrink-0 text-[10px]">
                              Expired
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {permissionSummary(invitation.permissions)} · expires{" "}
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!expired && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyInviteLink(invitation.inviteUrl)}
                          >
                            Copy link
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void resendInvitation(invitation.id, invitation.email)
                          }
                          disabled={busy === `invite:${invitation.id}`}
                        >
                          {expired ? "Resend (reactivate)" : "Resend"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            void removeInvitation(invitation.id, invitation.email)
                          }
                          disabled={busy === `invite:${invitation.id}`}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {canManageMembers && (
          <>
            <Separator />
            <form
              onSubmit={inviteMember}
              className="grid gap-3 sm:grid-cols-5 sm:items-center"
            >
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@agency.com"
                required
                className="sm:col-span-4"
              />
              <Button type="submit" disabled={busy === "invite"} className="">
                {busy === "invite" ? "Inviting..." : "Invite"}
              </Button>
              {canGrantPermissions && (
                <div className="sm:col-span-5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Optional permissions for this member
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {PERMISSIONS.map((permission) => (
                      <label
                        key={permission.value}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Switch
                          size="sm"
                          checked={invitePermissions.includes(permission.value)}
                          onCheckedChange={(checked) =>
                            setInvitePermissions((current) =>
                              togglePermission(current, permission.value, checked)
                            )
                          }
                          disabled={busy === "invite"}
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <p className="sm:col-span-5 text-sm text-destructive">
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
