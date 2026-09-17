"use client";

/**
 * Inbox Automations — one master config per Instagram account.
 *
 * Simplified from multi-rule (keyword → intent → catch-all) to 2 types:
 *   AI reply (knowledge textbox, plain text, 500 char, no links) and
 *   Fallback reply (keyword list OR catch-all). One row per account.
 *   Pipeline is AI-first then fallback, fixing the "Heya for price" bug.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import { Robot } from "@phosphor-icons/react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
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
} from "@/lib/query/api";
import {
  canManageInboxAutomations,
  isOwner,
  useWorkspaceContext,
} from "@/lib/workspace-context";
import { AiProviderSettings } from "@/components/ai-provider-settings";
import { AI_PROVIDERS, isAiProvider, type AiProvider } from "@/lib/ai/providers";

const SELECTED_KEY = "inbox-automations:selectedAccount";

export default function InboxAutomationsPage() {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceContext();
  const canManage = canManageInboxAutomations(workspace);
  const owner = isOwner(workspace);
  const [requestedAccountId, setSelectedAccountId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(SELECTED_KEY) ?? "";
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccountList,
    staleTime: 60_000,
  });
  const accounts: AccountOption[] = accountsQuery.data?.instagramAccounts ?? [];

  const selectedAccountId = accounts.some((account) => account.id === requestedAccountId)
    ? requestedAccountId
    : accountsQuery.data?.selectedInstagramAccountId || accounts[0]?.id || "";

  useEffect(() => {
    if (typeof window !== "undefined" && selectedAccountId) {
      window.sessionStorage.setItem(SELECTED_KEY, selectedAccountId);
    }
  }, [selectedAccountId]);

  const configQuery = useQuery({
    queryKey: queryKeys.inboxAutomations(selectedAccountId),
    queryFn: () => fetchInboxAutomations(selectedAccountId || undefined),
    enabled: Boolean(selectedAccountId),
    staleTime: 15_000,
  });
  const config: InboxAutomationItem | null = useMemo(() => {
    const data = configQuery.data as unknown;
    if (Array.isArray(data)) return (data[0] as InboxAutomationItem) ?? null;
    return (data as InboxAutomationItem) ?? null;
  }, [configQuery.data]);

  // Form state — seeded from config
  const [isActive, setIsActive] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [knowledge, setKnowledge] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [fallbackKeywords, setFallbackKeywords] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [wholeWordMatch, setWholeWordMatch] = useState(true);
  const [matchAnyWord, setMatchAnyWord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundBusy, setPlaygroundBusy] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<{
    reply?: string;
    ai?: boolean;
    aiError?: string;
    matched?: string;
  } | null>(null);

  const [loadedForm, setLoadedForm] = useState<{ accountId: string; config: InboxAutomationItem | null } | null>(null);
  // Reset before rendering a newly loaded account/config so edits never flash
  // under the wrong account. Local edits do not change this snapshot.
  if (loadedForm?.accountId !== selectedAccountId || loadedForm?.config !== config) {
    setLoadedForm({ accountId: selectedAccountId, config });
    setIsActive(config?.isActive ?? true);
    setAiEnabled(config?.aiEnabled ?? false);
    setKnowledge(config?.knowledge ?? "");
    const provider = isAiProvider(config?.aiProvider) ? config.aiProvider : "openai";
    setAiProvider(provider);
    setAiModel(config?.aiModel ?? AI_PROVIDERS[provider].models[0].id);
    setFallbackKeywords((config?.fallbackKeywords ?? []).join(", "));
    setFallbackMessage(config?.fallbackMessage ?? "");
    setWholeWordMatch(config?.wholeWordMatch ?? true);
    setMatchAnyWord(config?.matchAnyWord ?? false);
    setPlaygroundResult(null);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.inboxAutomations(selectedAccountId) });
  }

  async function save() {
    if (!selectedAccountId) return;
    if (!canManage) return gooeyToast.error("No permission");
    setSaving(true);
    try {
      const payload = {
        instagramAccountId: selectedAccountId,
        isActive,
        knowledge: knowledge.trim() || null,
        fallbackKeywords: fallbackKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 10),
        fallbackMessage,
        wholeWordMatch,
        matchAnyWord,
        ...(owner
          ? {
              aiEnabled,
              aiProvider: aiProvider.trim() || null,
              aiModel: aiModel.trim() || null,
            }
          : {}),
      };
      const res = config
        ? await fetch(`/api/inbox-automations?id=${config.id}`, {
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
        const details = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        const first = details && Object.keys(details)[0];
        throw new Error(first ? `${first}: ${details[first][0]}` : data?.error ?? "Failed to save");
      }
      gooeyToast.success(config ? "Config saved" : "Config created");
      invalidate();
    } catch (e) {
      gooeyToast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeConfig() {
    if (!config) return;
    if (!window.confirm("Delete inbox config for this account?")) return;
    try {
      const res = await fetch(`/api/inbox-automations?id=${config.id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!payload?.success) throw new Error(payload?.error ?? "Failed");
      gooeyToast.success("Config deleted");
      invalidate();
    } catch (e) {
      gooeyToast.error(e instanceof Error ? e.message : "Failed to delete");
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
      setPlaygroundResult({
        reply: payload.data?.reply,
        ai: payload.data?.ai,
        aiError: payload.data?.aiError,
        matched: payload.data?.matched?.type,
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Inbox Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One master config per account — AI reply first, then simple fallback. Fixes keyword-shadow bugs.
          </p>
        </div>
        {accounts.length > 0 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
          />
        )}
      </div>

      {!canManage && <p className="text-sm text-muted-foreground">You have view-only access.</p>}

      {!selectedAccountId ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Connect an Instagram account to configure inbox replies.
          </CardContent>
        </Card>
      ) : configQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Master Config</h2>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!canManage} /> Active
                </label>
              </div>
              {config && (
                <p className="text-xs text-muted-foreground">
                  One row per account — editing the single master database entry.
                </p>
              )}
              {!config && !owner && (
                <p className="text-xs text-muted-foreground">
                  Only the workspace owner can create the first inbox automation for an account.
                </p>
              )}

              {/* AI Reply */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    <Robot className="mr-1 inline size-4" /> AI Reply
                    <span className="block text-xs font-normal text-muted-foreground">
                      Plain text, 500 characters, no links. Connect a provider for this workspace to enable AI replies.
                    </span>
                  </span>
                  {owner ? (
                    <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {aiEnabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
                {owner && aiEnabled && (
                  <AiProviderSettings key={`${selectedAccountId}:${aiProvider}`} provider={aiProvider} model={aiModel}
                      onProviderChange={(provider) => {
                        setAiProvider(provider);
                        setAiModel(AI_PROVIDERS[provider].models[0].id);
                      }} onModelChange={setAiModel} />
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium">Knowledge (system prompt)</label>
                  <Textarea
                    value={knowledge}
                    onChange={(e) => setKnowledge(e.target.value)}
                    placeholder="What you sell, prices, timings, policies — AI grounds every claim in this."
                    rows={4}
                    maxLength={4000}
                    disabled={!canManage}
                  />
                  <p className="text-xs text-muted-foreground">{knowledge.length}/4000</p>
                </div>
              </div>

              {/* Fallback */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h3 className="text-sm font-medium">Fallback Reply</h3>
                <p className="text-xs text-muted-foreground">
                  Sent when AI is off, budget exhausted, or AI fails. If keywords empty it’s a catch-all; otherwise keyword-gated.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Keywords (comma separated)</label>
                  <Input
                    value={fallbackKeywords}
                    onChange={(e) => setFallbackKeywords(e.target.value)}
                    placeholder="hey, hello, price, cost"
                    disabled={!canManage}
                  />
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={wholeWordMatch} onCheckedChange={setWholeWordMatch} disabled={!canManage} /> Whole word
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={matchAnyWord} onCheckedChange={setMatchAnyWord} disabled={!canManage} /> Match any message
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Reply message — supports {"{username}"}</label>
                  <Textarea
                    value={fallbackMessage}
                    onChange={(e) => setFallbackMessage(e.target.value)}
                    placeholder="Hey {username}! Thanks for reaching out…"
                    rows={3}
                    maxLength={1000}
                    disabled={!canManage}
                  />
                  <p className="text-xs text-muted-foreground">When AI is enabled this is not used unless AI fails.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-between">
                <div>
                  {config && owner && (
                    <Button variant="ghost" onClick={() => void removeConfig()} className="text-destructive">
                      Delete config
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void save()} disabled={saving || !canManage || (!config && !owner)}>
                    {saving ? "Saving…" : config ? "Save changes" : "Create config"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-sm font-semibold">Test playground</h2>
              <p className="text-xs text-muted-foreground">Test the saved configuration — save changes before testing. AI first, then fallback. No message is sent.</p>
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
                <Button onClick={() => void runPlayground()} disabled={!canManage || playgroundBusy || !playgroundInput.trim()}>
                  {playgroundBusy ? "Testing…" : "Test"}
                </Button>
              </div>
              {playgroundResult && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  {playgroundResult.reply ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Via <span className="font-medium text-foreground">{playgroundResult.matched ?? "fallback"}</span>
                        {playgroundResult.ai && <span className="ml-1 text-primary">· AI generated</span>}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{playgroundResult.reply}</p>
                      {playgroundResult.aiError && (
                        <p className="mt-1 text-xs text-amber-600">AI failed, showed fallback: {playgroundResult.aiError}</p>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-muted-foreground">No reply would be sent for this message.</p>
                      {playgroundResult.aiError && <p className="mt-1 text-xs text-amber-600">{playgroundResult.aiError}</p>}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
