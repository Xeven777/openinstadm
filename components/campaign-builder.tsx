"use client";

/**
 * Campaign Builder
 *
 * Two-pane campaign editor: a control bg-muted on the left and a live phone
 * preview on the right. Used for both creating and editing a campaign.
 *
 * Turn 1 wires the fully-functional pieces: trigger scope (specific / any /
 * next post), match mode (specific words / any word), the opening + reveal DM
 * text, public reply, and the tracked link. Button-driven delivery and the
 * follow / email / follow-up steps arrive in later turns.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import { Plus, Warning, X } from "@phosphor-icons/react";
import AccountSelect from "@/components/account-select";
import PostPicker from "@/components/post-picker";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/query/keys";
import {
  fetchAccountList,
  fetchCampaignDetail,
  fetchProfile,
  fetchUsedPosts,
} from "@/lib/query/api";
import {
  IMPORT_QUEUE_KEY,
  IMPORT_ACCOUNT_KEY,
  type ImportRow,
} from "@/lib/import-queue";

type TriggerScope = "specific" | "any" | "next";
type MatchMode = "specific" | "any";

interface LoadedCampaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  trackedLinks?: { destinationUrl: string; label?: string | null }[];
}

interface CampaignBuilderProps {
  mode: "new" | "edit";
  campaignId?: string;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Radio({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
        checked
          ? "border-primary bg-primary/5"
          : "border-border hover:border-foreground/20"
      }`}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
          checked ? "border-primary" : "border-zinc-500"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 text-foreground">{children}</span>
    </button>
  );
}

export default function CampaignBuilder({ mode, campaignId }: CampaignBuilderProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [triggerScope, setTriggerScope] = useState<TriggerScope>("specific");
  const [postId, setPostId] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");

  // Post IDs already tied to another automation on this account, so the picker
  // can flag them and the user knows not to double-assign. Maps postId ->
  // the campaign name using it (for the tooltip).
  const [usedPosts, setUsedPosts] = useState<Record<string, string>>({});

  const [matchMode, setMatchMode] = useState<MatchMode>("specific");
  const [keywordText, setKeywordText] = useState("");
  const [dmTriggerEnabled, setDmTriggerEnabled] = useState(false);

  const [publicReplyEnabled, setPublicReplyEnabled] = useState(false);
  const [publicReplyMessages, setPublicReplyMessages] = useState<string[]>([""]);

  const [openingDmEnabled, setOpeningDmEnabled] = useState(false);
  const [openingDmMessage, setOpeningDmMessage] = useState("");
  const [openingDmButtonLabel, setOpeningDmButtonLabel] = useState("");

  const [dmMessage, setDmMessage] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [trackedDestinationUrl, setTrackedDestinationUrl] = useState("");
  const [linkButtonLabel, setLinkButtonLabel] = useState("Open link");
  const [secondLinkOpen, setSecondLinkOpen] = useState(false);
  const [secondaryDestinationUrl, setSecondaryDestinationUrl] = useState("");
  const [secondaryButtonLabel, setSecondaryButtonLabel] = useState("Open link");
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessage, setFollowPromptMessage] = useState("");
  const [followPromptButtonLabel, setFollowPromptButtonLabel] =
    useState("i'm following");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(0);

  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");

  // CSV import queue. When present, each save advances to the next row instead
  // of returning to the campaigns list.
  const [importQueue, setImportQueue] = useState<ImportRow[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);

  const keywords = useMemo(
    () =>
      keywordText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    [keywordText]
  );

  // Fetch the connected account's real avatar for the preview. Cached by
  // TanStack Query (+ IndexedDB), so it shows instantly on a return visit
  // instead of a blank circle; switching accounts swaps the key and refetches.
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(selectedAccountId),
    queryFn: () => fetchProfile(selectedAccountId),
    enabled: Boolean(selectedAccountId),
    staleTime: 30 * 60 * 1000,
  });
  const avatarUrl = profileQuery.data?.profilePictureUrl ?? null;

  // Load accounts (both modes need them for the preview username + selector).
  // Uses the lightweight accounts endpoint rather than the heavy dashboard
  // stats aggregation, so the builder isn't gated on analytics.
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccountList,
    staleTime: 60_000,
  });
  // Derive the list directly from the query — no parallel state to sync.
  const accounts = accountsQuery.data?.instagramAccounts ?? [];
  // Seed the selected account on first load: keep the existing choice only if
  // it's still connected, otherwise fall back to the server default.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!accountsQuery.data) return;
    const next = accountsQuery.data.instagramAccounts;
    if (!next.length) return;
    setSelectedAccountId(
      (prev) =>
        prev ||
        accountsQuery.data?.selectedInstagramAccountId ||
        next[0]?.id ||
        ""
    );
  }, [accountsQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Prefill when editing — single-row fetch via getCampaignDetail, cached by
  // TanStack Query (no full-list + 3 groupBy aggregations).
  const detailQuery = useQuery({
    queryKey: queryKeys.campaignDetail(campaignId ?? ""),
    queryFn: () => fetchCampaignDetail(campaignId!),
    enabled: mode === "edit" && Boolean(campaignId),
    staleTime: 60_000,
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "edit") return;
    if (detailQuery.isPending) return;
    if (detailQuery.isError || !detailQuery.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const c = detailQuery.data as LoadedCampaign;
    setName(c.name);
    setSelectedAccountId(c.instagramAccountId);
    setTriggerScope(
      c.matchAnyPost ? "any" : c.pendingNextReel ? "next" : "specific"
    );
    setPostId(c.postId);
    setPostUrl(c.postUrl);
    setMatchMode(c.matchAnyWord ? "any" : "specific");
    setKeywordText(c.keywords.join(", "));
    setDmTriggerEnabled(c.dmTriggerEnabled ?? false);
    setPublicReplyEnabled(c.publicReplyEnabled);
    setPublicReplyMessages(
      c.publicReplyMessages?.length
        ? c.publicReplyMessages
        : c.publicReplyMessage
          ? [c.publicReplyMessage]
          : [""]
    );
    setOpeningDmEnabled(c.openingDmEnabled);
    setOpeningDmMessage(c.openingDmMessage ?? "");
    setOpeningDmButtonLabel(c.openingDmButtonLabel ?? "");
    setDmMessage(c.dmMessage);
    setLinkButtonLabel(c.linkButtonLabel ?? "Open link");
    setIsActive(c.isActive);
    const link = c.trackedLinks?.[0]?.destinationUrl ?? "";
    setTrackedDestinationUrl(link);
    setLinkOpen(Boolean(link));
    const secondLink = c.trackedLinks?.[1];
    setSecondaryDestinationUrl(secondLink?.destinationUrl ?? "");
    setSecondaryButtonLabel(secondLink?.label ?? "Open link");
    setSecondLinkOpen(Boolean(secondLink?.destinationUrl));
    setRequireFollow(c.requireFollow ?? false);
    setFollowPromptMessage(c.followPromptMessage ?? "");
    setFollowPromptButtonLabel(c.followPromptButtonLabel ?? "i'm following");
    setFollowUpEnabled(c.followUpEnabled ?? false);
    setFollowUpMessage(c.followUpMessage ?? "");
    setFollowUpDelayMinutes(c.followUpDelayMinutes ?? 0);
    setLoading(false);
  }, [
    mode,
    detailQuery.data,
    detailQuery.isPending,
    detailQuery.isError,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Track which posts on the selected account are already assigned to an
  // automation, so the picker can highlight them. Uses the lightweight
  // `?fields=used-posts` projection (4 columns, no analytics groupBys) cached
  // by TanStack Query keyed by account — deduped, stale-while-revalidate, no
  // refetch on every account switch mount.
  const usedPostsQuery = useQuery({
    queryKey: queryKeys.usedPosts(selectedAccountId),
    queryFn: () => fetchUsedPosts(selectedAccountId),
    enabled: Boolean(selectedAccountId),
    staleTime: 60_000,
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!usedPostsQuery.data) return;
    const map: Record<string, string> = {};
    for (const a of usedPostsQuery.data) {
      if (a.postId == null) continue;
      if (mode === "edit" && a.id === campaignId) continue;
      map[a.postId] = a.name;
    }
    setUsedPosts(map);
  }, [usedPostsQuery.data, mode, campaignId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Prefill the editable fields from one queued import row. The reel is left
  // unset so the user picks it per row.
  function prefillFromRow(row: ImportRow) {
    setName(row.name ?? "");
    setTriggerScope("specific");
    setPostId(null);
    setPostUrl(null);
    setPostThumb(null);
    setPostCaption("");
    setMatchMode("specific");
    setKeywordText((row.keywords ?? []).join(", "));
    setDmTriggerEnabled(false);
    setDmMessage(row.dmMessage ?? "");
    setPublicReplyEnabled(Boolean(row.publicReply));
    setPublicReplyMessages(row.publicReply ? [row.publicReply] : [""]);
    const hasOpening = Boolean(row.openingDmMessage);
    setOpeningDmEnabled(hasOpening);
    setOpeningDmMessage(row.openingDmMessage ?? "");
    setOpeningDmButtonLabel(
      row.openingDmButtonLabel || (hasOpening ? "Send link" : "")
    );
    const link = row.trackedUrl ?? "";
    setTrackedDestinationUrl(link);
    setLinkOpen(Boolean(link));
    setLinkButtonLabel("Open link");
    setSecondLinkOpen(false);
    setSecondaryDestinationUrl("");
    setSecondaryButtonLabel("Open link");
    setRequireFollow(false);
    setFollowPromptMessage("");
    setFollowPromptButtonLabel("i'm following");
    setFollowUpEnabled(false);
    setFollowUpMessage("");
    setFollowUpDelayMinutes(0);
    setError(null);
  }

  // Pick up a staged CSV import (new mode only) and prefill the first row.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "new") return;
    try {
      const raw = window.localStorage.getItem(IMPORT_QUEUE_KEY);
      const acct = window.localStorage.getItem(IMPORT_ACCOUNT_KEY);
      if (!raw) return;
      const queue = JSON.parse(raw) as ImportRow[];
      if (!Array.isArray(queue) || queue.length === 0) return;
      setImportQueue(queue);
      setImportTotal(queue.length);
      if (acct) setSelectedAccountId(acct);
      prefillFromRow(queue[0]);
    } catch {
      // ignore a malformed queue
    }
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const username =
    accounts.find((a) => a.id === selectedAccountId)?.username ?? "yourbrand";

  function handlePostSelect(
    id: string,
    url?: string,
    thumb?: string,
    caption?: string
  ) {
    setPostId(id);
    setPostUrl(url ?? null);
    setPostThumb(thumb ?? null);
    setPostCaption(caption ?? "");
  }

  function ensureLinkToken() {
    setDmMessage((cur) => (cur.includes("{link}") ? cur : `${cur.trim()} {link}`.trim()));
  }

  function selectTriggerScope(nextScope: TriggerScope) {
    setTriggerScope(nextScope);
    if (nextScope !== "specific") {
      setPostId(null);
      setPostUrl(null);
      setPostThumb(null);
      setPostCaption("");
    }
  }

  async function handleSubmit(activeValue: boolean) {
    setError(null);

    if (!selectedAccountId) return setError("Connect an Instagram account first.");
    if (triggerScope === "specific" && !postId)
      return setError("Pick a post or reel to trigger the campaign.");
    if (matchMode === "specific" && keywords.length === 0)
      return setError("Add at least one keyword, or switch to any word.");
    if (!dmMessage.trim()) return setError("Add the DM with the link.");
    if (openingDmEnabled && (!openingDmMessage.trim() || !openingDmButtonLabel.trim()))
      return setError("Your opening DM needs a message and a button label.");

    setSaving(true);

    const payload = {
      name: name.trim() || `Campaign for @${username}`,
      instagramAccountId: selectedAccountId,
      postId: triggerScope === "specific" ? postId : null,
      postUrl: triggerScope === "specific" ? postUrl : null,
      matchAnyPost: triggerScope === "any",
      pendingNextReel: triggerScope === "next",
      matchAnyWord: matchMode === "any",
      keywords: matchMode === "any" ? [] : keywords,
      dmTriggerEnabled,
      dmMessage,
      openingDmEnabled,
      openingDmMessage: openingDmEnabled ? openingDmMessage : null,
      openingDmButtonLabel: openingDmEnabled ? openingDmButtonLabel : null,
      publicReplyEnabled,
      publicReplyMessages: publicReplyEnabled
        ? publicReplyMessages.map((m) => m.trim()).filter(Boolean)
        : [],
      trackedDestinationUrl: trackedDestinationUrl.trim() || "",
      linkButtonLabel: linkButtonLabel.trim() || "Open link",
      secondaryDestinationUrl: secondaryDestinationUrl.trim() || "",
      secondaryButtonLabel: secondaryButtonLabel.trim() || "Open link",
      requireFollow,
      followPromptMessage: requireFollow ? followPromptMessage.trim() : "",
      followPromptButtonLabel: requireFollow
        ? followPromptButtonLabel.trim() || "i'm following"
        : "",
      followUpEnabled,
      followUpMessage: followUpEnabled ? followUpMessage.trim() : "",
      followUpDelayMinutes: followUpEnabled ? followUpDelayMinutes : 0,
      isActive: activeValue,
    };

    try {
      const res =
        mode === "new"
          ? await fetch("/api/automations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/automations?id=${campaignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (data.success) {
        // The post we just assigned is now in use. Reflect it immediately so
        // the picker flags it on the next imported row — the fetch that builds
        // this map doesn't re-run while the builder stays mounted through the
        // import queue.
        if (triggerScope === "specific" && postId) {
          const assignedPostId = postId;
          setUsedPosts((prev) => ({ ...prev, [assignedPostId]: payload.name }));
        }
        // Importing: advance to the next queued row instead of leaving.
        if (importQueue && importQueue.length > 1) {
          const remaining = importQueue.slice(1);
          try {
            window.localStorage.setItem(
              IMPORT_QUEUE_KEY,
              JSON.stringify(remaining)
            );
          } catch {
            // ignore
          }
          setImportQueue(remaining);
          prefillFromRow(remaining[0]);
          setSaving(false);
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          return;
        }
        if (importQueue) {
          try {
            window.localStorage.removeItem(IMPORT_QUEUE_KEY);
            window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
          } catch {
            // ignore
          }
        }
        // refresh() busts the router cache so the list reflects the save
        // instead of landing on a stale (empty) campaigns page.
        gooeyToast.success(
          mode === "new" ? "Campaign created" : "Campaign saved"
        );
        router.push("/campaigns");
        router.refresh();
      } else {
        // Surface the specific field that failed validation instead of a
        // generic "Invalid input".
        const fieldErrors = data.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const firstField = fieldErrors && Object.keys(fieldErrors)[0];
        setError(
          firstField
            ? `${firstField}: ${fieldErrors[firstField][0]}`
            : data.error ?? "Failed to save campaign"
        );
        if (typeof window !== "undefined")
          window.scrollTo({ top: 0, behavior: "smooth" });
        gooeyToast.error("Could not save campaign");
      }
    } catch {
      setError("Failed to save campaign");
      gooeyToast.error("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  // Skip the current imported row without saving a campaign for it, advancing
  // to the next one (or finishing the import if it was the last).
  function skipRow() {
    if (!importQueue) return;
    setError(null);
    if (importQueue.length > 1) {
      const remaining = importQueue.slice(1);
      try {
        window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(remaining));
      } catch {
        // ignore
      }
      setImportQueue(remaining);
      prefillFromRow(remaining[0]);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return;
    }
    // Last row skipped — finish the import.
    try {
      window.localStorage.removeItem(IMPORT_QUEUE_KEY);
      window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
    } catch {
      // ignore
    }
    router.push("/campaigns");
    router.refresh();
  }

  if (loading) {
    return <div className="bg-muted h-64 rounded" />;
  }

  if (notFound) {
    return (
      <div className="bg-muted rounded p-8 text-center">
        <p className="text-sm text-muted-foreground">Campaign not found.</p>
        <Button
          variant="outline"
          onClick={() => router.push("/campaigns")}
          className="mt-4"
        >
          Back to campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {importQueue && (
        <div className="rounded border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            Importing {importTotal - importQueue.length + 1} of {importTotal}.
          </span>{" "}
          <span className="text-muted-foreground">
            Fields are prefilled from your CSV. Pick the reel, edit anything,
            and save to load the next one — or Skip if you don&rsquo;t want this
            one.
          </span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {mode === "edit" ? (
            <>
              <span className="truncate text-sm font-semibold text-foreground">
                {name || "Untitled campaign"}
              </span>
              <Badge variant={isActive ? "success" : "muted"}>
                {isActive ? "LIVE" : "PAUSED"}
              </Badge>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">New campaign</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {importQueue && (
            <Button
              type="button"
              variant="outline"
              onClick={skipRow}
              disabled={saving}
            >
              {importQueue.length > 1 ? "Skip" : "Skip & finish"}
            </Button>
          )}
          {mode === "edit" &&
            (isActive ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={saving}
              >
                Stop
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={saving}
              >
                Go Live
              </Button>
            ))}
          <Button
            type="button"
            onClick={() => handleSubmit(mode === "new" ? true : isActive)}
            disabled={saving}
          >
            {saving ? "Saving…" : mode === "new" ? "Go Live" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
        {/* Left: controls */}
        <div className="space-y-8">
          {error && (
            <Alert variant="destructive">
              <Warning weight="fill" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">
              Campaign name{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YC referral"
              maxLength={100}
            />
            {accounts.length > 1 && (
              <div className="pt-2">
                <AccountSelect
                  accounts={accounts}
                  value={selectedAccountId}
                  onChange={(id) => {
                    setSelectedAccountId(id);
                    setPostId(null);
                    setPostUrl(null);
                    setPostThumb(null);
                    setPostCaption("");
                  }}
                  includeAll={false}
                  label="Instagram account"
                />
              </div>
            )}
          </div>

          <Section title="When someone comments on">
            <Radio
              checked={triggerScope === "specific"}
              onSelect={() => selectTriggerScope("specific")}
            >
              a specific post or reel
            </Radio>
            {triggerScope === "specific" && (
              <div className="rounded-lg border border-border p-2">
                <PostPicker
                  selectedPostId={postId}
                  instagramAccountId={selectedAccountId}
                  usedPostIds={usedPosts}
                  onSelect={handlePostSelect}
                />
              </div>
            )}
            <Radio
              checked={triggerScope === "any"}
              onSelect={() => selectTriggerScope("any")}
            >
              any post or reel
            </Radio>
            <Radio
              checked={triggerScope === "next"}
              onSelect={() => selectTriggerScope("next")}
            >
              next post or reel
            </Radio>
          </Section>

          <Section title="And this comment has">
            <Radio
              checked={matchMode === "specific"}
              onSelect={() => setMatchMode("specific")}
            >
              a specific word or words
            </Radio>
            {matchMode === "specific" && (
              <div className="space-y-1">
                <Input
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  placeholder="Enter a word or multiple"
                />
                <p className="text-xs text-muted-foreground">
                  Use commas to separate words
                </p>
              </div>
            )}
            <Radio
              checked={matchMode === "any"}
              onSelect={() => setMatchMode("any")}
            >
              any word
            </Radio>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm text-foreground">
                also reply when someone DMs{" "}
                {matchMode === "any" ? "anything" : "these words"}
              </span>
              <Switch
                checked={dmTriggerEnabled}
                onCheckedChange={setDmTriggerEnabled}
              />
            </div>
            {dmTriggerEnabled && (
              <p className="text-xs text-muted-foreground">
                {matchMode === "any"
                  ? "Every DM to this account gets the reply below — use with care."
                  : "A DM containing any of these words gets the same reply, no comment needed."}
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm text-foreground">
                reply to their comments under the post
              </span>
              <Switch
                checked={publicReplyEnabled}
                onCheckedChange={setPublicReplyEnabled}
              />
            </div>
            {publicReplyEnabled && (
              <div className="space-y-2">
                {publicReplyMessages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={msg}
                      onChange={(e) =>
                        setPublicReplyMessages((prev) =>
                          prev.map((m, idx) =>
                            idx === i ? e.target.value : m,
                          ),
                        )
                      }
                      placeholder="Sent you a DM! 📩"
                      maxLength={1000}
                    />
                    {publicReplyMessages.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          setPublicReplyMessages((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remove reply"
                      >
                        <X weight="bold" />
                      </Button>
                    )}
                  </div>
                ))}
                {publicReplyMessages.length < 10 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPublicReplyMessages((prev) => [...prev, ""])
                    }
                    className="px-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus weight="bold" />
                    Add another reply
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  One is picked at random each time, so replies don&apos;t look
                  identical.
                </p>
              </div>
            )}
          </Section>

          <Section title="They will get">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">an opening DM</span>
                <Switch
                  checked={openingDmEnabled}
                  onCheckedChange={setOpeningDmEnabled}
                />
              </div>
              {openingDmEnabled && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={openingDmMessage}
                    onChange={(e) => setOpeningDmMessage(e.target.value)}
                    placeholder="Hey there! I'm so happy you're here 😊"
                    rows={3}
                    maxLength={1000}
                  />
                  <Input
                    value={openingDmButtonLabel}
                    onChange={(e) => setOpeningDmButtonLabel(e.target.value)}
                    placeholder="Send me the link"
                    maxLength={64}
                  />
                </div>
              )}
            </div>
            <div className="mt-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  a follow requirement first
                </span>
                <Switch
                  checked={requireFollow}
                  onCheckedChange={setRequireFollow}
                />
              </div>
              {requireFollow && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={followPromptMessage}
                    onChange={(e) => setFollowPromptMessage(e.target.value)}
                    placeholder="quick favor before i send your link. i don't make any money from this, it's free. if you want to support me, just don't unfollow after, and star the repo on github if it helps you. tap the button once you're following and i'll send it over"
                    rows={3}
                    maxLength={1000}
                  />
                  <Input
                    value={followPromptButtonLabel}
                    onChange={(e) => setFollowPromptButtonLabel(e.target.value)}
                    placeholder="i'm following"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    We send the link only after they tap the button and
                    Instagram confirms the follow. If it can&apos;t be verified,
                    we send it anyway.
                  </p>
                </div>
              )}
            </div>
          </Section>

          <Section title="And then, they will get">
            <div className="rounded-lg border border-border p-3 space-y-2">
              <span className="text-sm text-foreground">a DM with a link</span>
              <Textarea
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="Write a message"
                rows={3}
                maxLength={1000}
              />
              {linkOpen ? (
                <div className="space-y-2">
                  <Input
                    value={trackedDestinationUrl}
                    onChange={(e) => setTrackedDestinationUrl(e.target.value)}
                    onBlur={ensureLinkToken}
                    placeholder="https://yourlink.com/offer"
                  />
                  <Input
                    value={linkButtonLabel}
                    onChange={(e) => setLinkButtonLabel(e.target.value)}
                    placeholder="Button label (e.g. Open link)"
                    maxLength={20}
                  />
                  {secondLinkOpen ? (
                    <div className="space-y-2 border-t border-border pt-2">
                      <Input
                        value={secondaryDestinationUrl}
                        onChange={(e) =>
                          setSecondaryDestinationUrl(e.target.value)
                        }
                        placeholder="https://yourlink.com/second"
                      />
                      <Input
                        value={secondaryButtonLabel}
                        onChange={(e) =>
                          setSecondaryButtonLabel(e.target.value)
                        }
                        placeholder="Second button label"
                        maxLength={20}
                      />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSecondLinkOpen(true)}
                      className="w-full"
                    >
                      <Plus weight="bold" />
                      Add A Second Link
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLinkOpen(true)}
                  className="w-full"
                >
                  <Plus weight="bold" />
                  Add A Link
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {"{link}"} inserts the tracked link; {"{username}"}{" "}
                personalizes.
              </p>
            </div>
            <div className="mt-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  a follow-up thank-you message
                </span>
                <Switch
                  checked={followUpEnabled}
                  onCheckedChange={setFollowUpEnabled}
                />
              </div>
              {followUpEnabled && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={followUpMessage}
                    onChange={(e) => setFollowUpMessage(e.target.value)}
                    placeholder="Btw just wanted to say thanks for following me, I appreciate the support 🙌"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    <span className="text-xs text-muted-foreground">
                      Send it
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={1440}
                      value={followUpDelayMinutes}
                      onChange={(e) =>
                        setFollowUpDelayMinutes(
                          Math.max(
                            0,
                            Math.min(
                              1440,
                              Math.floor(Number(e.target.value) || 0),
                            ),
                          ),
                        )
                      }
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">
                      minutes after the link
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {followUpDelayMinutes > 0
                      ? `Sent ${followUpDelayMinutes} min after they tap through.`
                      : "Sent right after they tap through."}
                    {" {username}"} personalizes it. Max 24 hours, to stay
                    inside Instagram&apos;s messaging window.
                  </p>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Right: preview */}
        <div>
          <p className="mb-4 text-sm text-muted-foreground">Preview</p>
          <div className="flex justify-center lg:sticky lg:top-6 lg:block">
            <CampaignPreview
              tab={previewTab}
              onTabChange={setPreviewTab}
              username={username}
              avatarUrl={avatarUrl}
              postThumb={postThumb}
              caption={postCaption}
              sampleComment={keywords[0] ?? ""}
              dmTriggerEnabled={dmTriggerEnabled}
              publicReplyEnabled={publicReplyEnabled}
              publicReplyMessage={
                publicReplyMessages.find((m) => m.trim()) ?? ""
              }
              openingDmEnabled={openingDmEnabled}
              openingDmMessage={openingDmMessage}
              openingDmButtonLabel={openingDmButtonLabel}
              revealMessage={dmMessage}
              hasLink={Boolean(trackedDestinationUrl.trim())}
              linkButtonLabel={linkButtonLabel || "Open link"}
              linkUrl={trackedDestinationUrl.trim() || undefined}
              hasSecondLink={
                secondLinkOpen && Boolean(secondaryDestinationUrl.trim())
              }
              secondLinkButtonLabel={secondaryButtonLabel || "Open link"}
              requireFollow={requireFollow}
              followPromptMessage={followPromptMessage}
              followPromptButtonLabel={
                followPromptButtonLabel || "i'm following"
              }
              followUpEnabled={followUpEnabled}
              followUpMessage={followUpMessage}
              followUpDelayMinutes={followUpDelayMinutes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
