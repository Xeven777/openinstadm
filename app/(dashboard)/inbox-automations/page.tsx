"use client";

/**
 * Inbox Automations — DM-only auto-reply studio.
 *
 * Replaces the legacy per-account "Default DM reply" toggle with ordered,
 * feature-rich rules: keyword → AI intent → catch-all (ALWAYS).
 * DM-only, auto-send. AI replies are plain text grounded by the rule's
 * knowledge textbox (no RAG, never injects links).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import { Copy, Pencil, Plus, Robot, Trash, X } from "@phosphor-icons/react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/query/keys";
import {
  fetchAccountList,
  fetchInboxAutomations,
  type InboxAutomationItem,
  type InboxTrigger,
} from "@/lib/query/api";
import { canManageAutomations, useWorkspaceContext } from "@/lib/workspace-context";

const SELECTED_KEY = "inbox-automations:selectedAccount";

type Draft = {
  id?: string;
  name: string;
  triggerType: InboxTrigger;
  keywords: string;
  matchAnyWord: boolean;
  aiEnabled: boolean;
  aiIntent: string;
  knowledge: string;
  message: string;
  priority: number;
  isActive: boolean;
};

const emptyDraft = (triggerType: InboxTrigger = "KEYWORD"): Draft => ({
  name: "",
  triggerType,
  keywords: "",
  matchAnyWord: false,
  aiEnabled: false,
  aiIntent: "",
  knowledge: "",
  message: "",
  priority: 0,
  isActive: true,
});

function toDraft(r: InboxAutomationItem): Draft {
  return {
    id: r.id,
    name: r.name,
    triggerType: r.triggerType,
    keywords: r.keywords.join(", "),
    matchAnyWord: r.matchAnyWord,
    aiEnabled: r.aiEnabled,
    aiIntent: r.aiIntent ?? "",
    knowledge: r.knowledge ?? "",
    message: r.message ?? "",
    priority: r.priority,
    isActive: r.isActive,
  };
}

function triggerBadge(t: InboxTrigger) {
  if (t === "ALWAYS") return <Badge variant="secondary">Catch-all</Badge>;
  if (t === "AI_INTENT") return <Badge variant="outline">AI intent</Badge>;
  return <Badge variant="outline">Keywords</Badge>;
}

export default function InboxAutomationsPage() {
  const queryClient = useQueryClient();
  const canManage = canManageAutomations(useWorkspaceContext());
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(SELECTED_KEY) ?? "";
  });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundBusy, setPlaygroundBusy] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<{
    matchedName?: string;
    triggerType?: string;
    reply?: string;
    ai?: boolean;
    aiError?: string;
  } | null>(null);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccountList,
    staleTime: 60_000,
  });
  const accounts: AccountOption[] = accountsQuery.data?.instagramAccounts ?? [];

  useEffect(() => {
    if (!accounts.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed default account once list loads
    setSelectedAccountId((prev) => {
      const ok = prev && accounts.some((a) => a.id === prev);
      return ok
        ? prev
        : accountsQuery.data?.selectedInstagramAccountId || accounts[0]?.id || "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  useEffect(() => {
    if (typeof window !== "undefined" && selectedAccountId) {
      window.sessionStorage.setItem(SELECTED_KEY, selectedAccountId);
    }
  }, [selectedAccountId]);

  const rulesQuery = useQuery({
    queryKey: queryKeys.inboxAutomations(selectedAccountId),
    queryFn: () => fetchInboxAutomations(selectedAccountId || undefined),
    enabled: Boolean(selectedAccountId),
    staleTime: 15_000,
  });
  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const catchAllExists = rules.some((r) => r.triggerType === "ALWAYS");

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: queryKeys.inboxAutomations(selectedAccountId),
    });
  }

  async function toggleActive(rule: InboxAutomationItem, next: boolean) {
    try {
      const res = await fetch(`/api/inbox-automations?id=${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const payload = await res.json();
      if (!payload?.success) throw new Error(payload?.error ?? "Failed");
      invalidate();
    } catch (e) {
      gooeyToast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function removeRule(rule: InboxAutomationItem) {
    if (!window.confirm(`Delete "${rule.name}"?`)) return;
    try {
      const res = await fetch(`/api/inbox-automations?id=${rule.id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!payload?.success) throw new Error(payload?.error ?? "Failed");
      gooeyToast.success("Rule deleted");
      invalidate();
    } catch (e) {
      gooeyToast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  function duplicateRule(rule: InboxAutomationItem) {
    const d = toDraft(rule);
    setFormError(null);
    setEditing({
      ...d,
      id: undefined,
      name: `${d.name} copy`,
      triggerType: d.triggerType === "ALWAYS" ? "KEYWORD" : d.triggerType,
      priority: d.priority + 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveDraft() {
    if (!editing || !selectedAccountId) return;
    setFormError(null);
    if (!editing.name.trim()) return setFormError("Give the rule a name.");
    if (editing.triggerType === "KEYWORD" && !editing.matchAnyWord && !editing.keywords.trim()) {
      return setFormError("Add at least one keyword, or enable “match any message”.");
    }
    if (editing.triggerType === "AI_INTENT" && !editing.aiIntent.trim()) {
      return setFormError("AI intent needs a name (e.g. pricing).");
    }
    if (!editing.aiEnabled && !editing.message.trim()) {
      return setFormError("Add the reply message (or enable AI reply).");
    }
    setSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        instagramAccountId: selectedAccountId,
        triggerType: editing.triggerType,
        keywords: editing.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10),
        matchAnyWord: editing.matchAnyWord,
        aiEnabled: editing.aiEnabled,
        aiIntent: editing.aiIntent.trim() || null,
        knowledge: editing.knowledge.trim() || null,
        message: editing.message,
        priority: editing.priority,
        isActive: editing.isActive,
      };
      const res = editing.id
        ? await fetch(`/api/inbox-automations?id=${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/inbox-automations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!data?.success) {
        const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        const first = fieldErrors && Object.keys(fieldErrors)[0];
        throw new Error(first ? `${first}: ${fieldErrors[first][0]}` : data?.error ?? "Failed to save");
      }
      gooeyToast.success(editing.id ? "Rule saved" : "Rule created");
      setEditing(null);
      invalidate();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function runPlayground() {
    const text = playgroundInput.trim();
    if (!text || !selectedAccountId) return;
    setPlaygroundBusy(true);
    setPlaygroundResult(null);
    try {
      const res = await fetch("/api/inbox-automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId: selectedAccountId, messageText: text }),
      });
      const payload = await res.json();
      if (!payload?.success) throw new Error(payload?.error ?? "Preview failed");
      const d = payload.data;
      setPlaygroundResult({
        matchedName: d?.matched?.name,
        triggerType: d?.matched?.triggerType,
        reply: d?.reply,
        ai: d?.ai,
        aiError: d?.aiError,
      });
    } catch (e) {
      gooeyToast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPlaygroundBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Inbox Automations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DM-only auto-replies evaluated in order: keywords → AI intent →
            catch-all. First match wins and sends instantly.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {accounts.length > 0 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              includeAll={false}
            />
          )}
          {canManage && selectedAccountId && (
            <Button
              onClick={() => {
                setFormError(null);
                setEditing(emptyDraft());
              }}
            >
              <Plus weight="bold" /> New rule
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <p className="text-sm text-muted-foreground">
          You have view-only access.
        </p>
      )}

      {/* Builder */}
      {editing && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {editing.id ? "Edit rule" : "New rule"}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                <X weight="bold" />
              </Button>
            </div>
            {formError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="e.g. Pricing FAQ"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Priority (lower runs first)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  value={editing.priority}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      priority: Math.max(
                        0,
                        Math.min(9999, Math.floor(Number(e.target.value) || 0)),
                      ),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Trigger</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["KEYWORD", "AI_INTENT", "ALWAYS"] as InboxTrigger[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={
                        t === "ALWAYS" &&
                        catchAllExists &&
                        toDraft.length >= 0 &&
                        !editing.id &&
                        rules.some((r) => r.triggerType === "ALWAYS")
                      }
                      onClick={() => setEditing({ ...editing, triggerType: t })}
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        editing.triggerType === t
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-foreground/20"
                      }`}
                    >
                      <span className="font-medium">
                        {t === "KEYWORD"
                          ? "Keywords"
                          : t === "AI_INTENT"
                            ? "AI intent"
                            : "Catch-all"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t === "KEYWORD"
                          ? "Match words in the DM"
                          : t === "AI_INTENT"
                            ? "Classify meaning, then reply"
                            : "Anything else (one per account)"}
                      </span>
                    </button>
                  ),
                )}
              </div>
              {editing.triggerType === "ALWAYS" &&
                catchAllExists &&
                !editing.id && (
                  <p className="text-xs text-amber-600">
                    This account already has a catch-all — edit it instead.
                  </p>
                )}
            </div>

            {editing.triggerType === "KEYWORD" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Keywords (comma separated)
                </label>
                <Input
                  value={editing.keywords}
                  onChange={(e) =>
                    setEditing({ ...editing, keywords: e.target.value })
                  }
                  placeholder="price, cost, how much"
                />
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.matchAnyWord}
                    onCheckedChange={(v) =>
                      setEditing({ ...editing, matchAnyWord: v })
                    }
                  />
                  Match any message
                </label>
              </div>
            )}

            {editing.triggerType === "AI_INTENT" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Intent name</label>
                <Input
                  value={editing.aiIntent}
                  onChange={(e) =>
                    setEditing({ ...editing, aiIntent: e.target.value })
                  }
                  placeholder="pricing"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  The classifier picks this intent when the DM means it — exact
                  wording doesn’t matter.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border p-3 space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  <Robot className="mr-1 inline size-4" />
                  AI reply
                  <span className="block text-xs font-normal text-muted-foreground">
                    Generate from knowledge. Plain text, no links. Needs
                    AI_API_KEY.
                  </span>
                </span>
                <Switch
                  checked={editing.aiEnabled}
                  onCheckedChange={(v) =>
                    setEditing({ ...editing, aiEnabled: v })
                  }
                />
              </label>
              {editing.aiEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Knowledge (added to the system prompt)
                  </label>
                  <Textarea
                    value={editing.knowledge}
                    onChange={(e) =>
                      setEditing({ ...editing, knowledge: e.target.value })
                    }
                    placeholder="What you sell, prices, timings, policies — the AI grounds every claim in this."
                    rows={4}
                    maxLength={4000}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editing.knowledge.length}/4000
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reply message{" "}
                {editing.aiEnabled && (
                  <span className="font-normal text-muted-foreground">
                    (static fallback when AI fails)
                  </span>
                )}
              </label>
              <Textarea
                value={editing.message}
                onChange={(e) =>
                  setEditing({ ...editing, message: e.target.value })
                }
                placeholder="Hey {username}! Thanks for reaching out…"
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {"{username}"} personalizes. Plain text — no link buttons on
                this page.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editing.isActive}
                  onCheckedChange={(v) =>
                    setEditing({ ...editing, isActive: v })
                  }
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void saveDraft()}
                  disabled={saving || !canManage}
                >
                  {saving
                    ? "Saving…"
                    : editing.id
                      ? "Save changes"
                      : "Create rule"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Rules{" "}
              {rules.length > 0 && (
                <span className="text-muted-foreground">({rules.length})</span>
              )}
            </h2>
            <span className="text-xs text-muted-foreground">
              Evaluated top-down by priority
            </span>
          </div>
          {rulesQuery.isPending ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rulesQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load rules.</p>
          ) : rules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">No inbox rules yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a keyword rule, an AI intent, or a catch-all so every DM
                gets an instant answer.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {r.name}
                      </span>
                      {triggerBadge(r.triggerType)}
                      {r.aiEnabled && <Badge variant="success">AI</Badge>}
                      {!r.isActive && <Badge variant="muted">Paused</Badge>}
                      <span className="text-xs text-muted-foreground">
                        prio {r.priority}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {r.triggerType === "ALWAYS"
                        ? "Anything unmatched"
                        : r.triggerType === "AI_INTENT"
                          ? `intent: ${r.aiIntent ?? "—"}`
                          : r.matchAnyWord
                            ? "any message"
                            : r.keywords.join(", ")}
                      {" · "}
                      {r._count ? `${r._count.dmLogs} logged` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={r.isActive}
                      onCheckedChange={(v) => void toggleActive(r, v)}
                      disabled={!canManage}
                      aria-label="Toggle active"
                    />
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setFormError(null);
                            setEditing(toDraft(r));
                          }}
                          aria-label="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => duplicateRule(r)}
                          aria-label="Duplicate"
                        >
                          <Copy />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void removeRule(r)}
                          aria-label="Delete"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Playground */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Test playground</h2>
          <p className="text-xs text-muted-foreground">
            Simulate an inbound DM against the active rules — no message is
            sent.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={playgroundInput}
              onChange={(e) => setPlaygroundInput(e.target.value)}
              placeholder="e.g. hey, what are your prices?"
              maxLength={1000}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runPlayground();
              }}
            />
            <Button
              onClick={() => void runPlayground()}
              disabled={playgroundBusy || !playgroundInput.trim()}
            >
              {playgroundBusy ? "Testing…" : "Test"}
            </Button>
          </div>
          {playgroundResult && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              {playgroundResult.matchedName ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Matched{" "}
                    <span className="font-medium text-foreground">
                      {playgroundResult.matchedName}
                    </span>
                    {playgroundResult.triggerType &&
                      ` (${playgroundResult.triggerType})`}
                    {playgroundResult.ai && (
                      <span className="ml-1 text-primary">· AI generated</span>
                    )}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {playgroundResult.reply || "(empty reply)"}
                  </p>
                  {playgroundResult.aiError && (
                    <p className="mt-1 text-xs text-amber-600">
                      AI failed, showed static text: {playgroundResult.aiError}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  No rule would reply to this message.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
