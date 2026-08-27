"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "goey-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function SettingsProfile({
  userName,
  userEmail,
}: {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}) {
  const router = useRouter();
  const [name, setName] = useState(userName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name cannot be empty");
      return;
    }
    if (trimmed.length > 50) {
      setError("Name must be 50 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9\s\-'.]{1,50}$/.test(trimmed)) {
      setError("Name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        setError(payload?.error ?? "Failed to save name");
        gooeyToast.error(payload?.error ?? "Failed to save name");
        return;
      }

      gooeyToast.success("Name updated");
      router.refresh();
    } catch {
      setError("Failed to save name");
      gooeyToast.error("Failed to save name");
    } finally {
      setSaving(false);
    }
  }

  const displayName = userName?.trim() ? userName : userEmail?.split("@")[0] ?? "User";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label htmlFor="profile-name" className="text-sm font-medium text-foreground w-24">
              Name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={50}
              className="flex-1 max-w-md"
              disabled={saving}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive ml-6">{error}</p>
          )}

          <p className="text-xs text-muted-foreground ml-6">
            This name appears in the sidebar, team list, and workspace creation.
            {userName ? "" : " Currently using email prefix as fallback."}
          </p>

          <Button
            onClick={handleSave}
            disabled={saving || name.trim() === (userName?.trim() ?? "")}
            className={cn(
              buttonVariants({ variant: "default" }),
              "ml-6",
              name.trim() === (userName?.trim() ?? "") && "opacity-50"
            )}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>

        <Separator />

        <div className="text-sm text-muted-foreground">
          <p>Email: <span className="text-foreground font-medium ml-1">{userEmail ?? "—"}</span></p>
          <p className="mt-1">
            Display name: <span className="text-foreground font-medium ml-1">{displayName}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}