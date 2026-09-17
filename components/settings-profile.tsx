"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "goey-toast";
import { Check, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function SettingsProfile({
  userName,
  userEmail,
  userRole,
}: {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  userRole?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(userName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
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
      setError(
        "Name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods",
      );
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

  const savedName = userName?.trim() ?? "";
  const isDirty = name.trim() !== savedName;
  const avatarSeed = (userEmail?.trim().toLowerCase() || savedName || "user");

  return (
    <Card>
      <CardContent className="gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.dicebear.com/10.x/thumbs/svg?seed=${encodeURIComponent(avatarSeed)}`}
            alt={savedName || userEmail || "Profile"}
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-full"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-foreground">
                {savedName || "Profile"}
              </h2>
              {userRole && (
                <Badge variant={userRole === "OWNER" ? "default" : "outline"}>
                  {userRole}
                </Badge>
              )}
            </div>
            {userEmail && (
              <p className="truncate text-sm text-muted-foreground">
                {userEmail}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="flex items-center gap-2">
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setName(savedName);
                setError(null);
              }
            }}
            placeholder="Your name"
            maxLength={50}
            autoComplete="name"
            disabled={saving}
            aria-invalid={!!error}
            className={cn("h-8 flex-1", error && "border-destructive")}
          />
          <Button
            type="submit"
            size="sm"
            disabled={saving || !isDirty || !name.trim()}
            className="shrink-0"
          >
            {saving ? (
              <>
                <CircleNotch weight="bold" className="animate-spin" />
                Saving
              </>
            ) : !isDirty ? (
              <>
                <Check weight="bold" />
                Saved
              </>
            ) : (
              "Save"
            )}
          </Button>
        </form>

        <div className="flex items-center justify-between gap-2">
          {error ? (
            <p className="flex min-w-0 items-center gap-1 text-xs text-destructive">
              <WarningCircle weight="fill" className="size-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              Shown in the sidebar and team list
            </p>
          )}
          <span
            className={cn(
              "shrink-0 text-[11px] tabular-nums",
              name.trim().length >= 50
                ? "text-destructive"
                : "text-muted-foreground/70",
            )}
          >
            {name.trim().length}/50
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
