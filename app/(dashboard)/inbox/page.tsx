"use client";

/**
 * Inbox
 *
 * Instagram DM conversations for the selected account, with live message
 * history and a reply composer. Messages are read from the Conversations API
 * (Meta only exposes the 20 most recent per thread) and refreshed by polling.
 * Sending is subject to Instagram's 24-hour messaging window — Meta's error is
 * surfaced verbatim when it applies.
 *
 * Data layer is TanStack Query:
 *  - conversations + thread messages are queries polled on a `refetchInterval`
 *    (TanStack pauses the interval while the tab is hidden and catches up on
 *    focus, replacing the old manual visibility listener);
 *  - the query cache is persisted to IndexedDB (lib/query/provider.tsx), so a
 *    same-browser revisit paints the last conversations/thread instantly and
 *    revalidates in the background;
 *  - sending is a mutation with an optimistic append, rolled back on error.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import {
  ArrowLeft,
  ChatCircle,
  InstagramLogo,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query/keys";
import {
  fetchAccountList,
  fetchConversations,
  fetchThreadMessages,
  sendDirectMessageApi,
  type ThreadMessage,
} from "@/lib/query/api";

const POLL_MS = 12_000;
// The seeded account is remembered in sessionStorage so a revisit can start on
// the right account before the account list resolves.
const SELECTED_ACCOUNT_KEY = "inbox:selectedAccount";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-2/3 rounded-lg" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-lg" />
      <Skeleton className="h-10 w-3/5 rounded-lg" />
      <Skeleton className="ml-auto h-10 w-1/3 rounded-lg" />
    </div>
  );
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  // Seed from the last-used account so a revisit can paint the cached
  // conversation list immediately, before the account list even loads.
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(SELECTED_ACCOUNT_KEY) ?? "";
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Always-latest selection/thread, so async mutation callbacks can tell where
  // to restore/roll back even if the user switched mid-flight.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  });

  // Accounts for the selector; default to the first connected account. Uses the
  // lightweight accounts endpoint (one query) rather than the heavy dashboard
  // stats aggregation, so the inbox isn't gated on analytics before it can load.
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccountList,
    staleTime: 60_000,
  });
  const accounts: AccountOption[] = accountsQuery.data?.instagramAccounts ?? [];

  // Resolve the default account: keep the seeded one only if it's still
  // connected, otherwise fall back to the default so a removed account can't
  // wedge the inbox.
  useEffect(() => {
    if (!accounts.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedAccountId((prev) => {
      const stillValid = prev && accounts.some((a) => a.id === prev);
      return stillValid
        ? prev
        : accountsQuery.data?.selectedInstagramAccountId ||
            accounts[0]?.id ||
            "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Remember the chosen account for the next visit.
  useEffect(() => {
    if (typeof window === "undefined" || !selectedAccountId) return;
    window.sessionStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccountId);
  }, [selectedAccountId]);

  // Reset the open thread when switching accounts. This is an intentional
  // synchronous reset on a dependency change, not derived render state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(null);
  }, [selectedAccountId]);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.conversations(selectedAccountId),
    queryFn: () =>
      fetchConversations(selectedAccountId).then((r) => r.conversations),
    enabled: Boolean(selectedAccountId),
    refetchInterval: POLL_MS,
  });
  const conversations = conversationsQuery.data ?? [];
  const convLoading = conversationsQuery.isPending;
  const convError = conversationsQuery.error ? conversationsQuery.error.message : null;

  const messagesQuery = useQuery({
    queryKey: queryKeys.messages(selectedAccountId, activeId ?? ""),
    queryFn: () =>
      fetchThreadMessages(selectedAccountId, activeId!).then((r) => r.messages),
    enabled: Boolean(selectedAccountId && activeId),
    refetchInterval: POLL_MS,
  });
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const threadLoading = messagesQuery.isPending;

  const openConversation = conversations.find((c) => c.id === activeId) ?? null;

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (input: { recipientId: string; text: string }) =>
      sendDirectMessageApi({
        instagramAccountId: selectedAccountId,
        ...input,
      }),
    onMutate: async ({ text }) => {
      const key = queryKeys.messages(selectedAccountId, activeId ?? "");
      await queryClient.cancelQueries({ queryKey: key });
      // Optimistically show the reply immediately, then confirm with the server.
      const optimistic: ThreadMessage = {
        id: `optimistic-${Date.now()}`,
        text,
        fromMe: true,
        fromUsername: null,
        createdTime: new Date().toISOString(),
      };
      queryClient.setQueryData<ThreadMessage[]>(key, (old) => [
        ...(old ?? []),
        optimistic,
      ]);
    },
    onError: (err, vars) => {
      // Roll the optimistic message back (refetch server truth) and restore the
      // draft so the text isn't lost.
      if (activeIdRef.current) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages(selectedAccountId, activeIdRef.current),
        });
      }
      setDraft(vars.text);
      setSendError(err instanceof Error ? err.message : "Failed to send message");
      gooeyToast.error("Message not sent");
    },
    onSuccess: () => {
      gooeyToast.success("Message sent");
    },
    onSettled: () => {
      // Refresh both the list (last message + ordering) and the thread.
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(selectedAccountId),
      });
      if (activeIdRef.current) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages(selectedAccountId, activeIdRef.current),
        });
      }
    },
  });

  async function handleSend() {
    const text = draft.trim();
    if (!text || !openConversation?.contact.id || sendMutation.isPending) return;
    setSendError(null);
    setDraft("");
    await sendMutation.mutateAsync({
      recipientId: openConversation.contact.id,
      text,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const sending = sendMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct messages from commenters — read and reply in real time.
          </p>
        </div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
          />
        )}
      </div>

      <Card className="h-[calc(100dvh-12.5rem)] p-0">
        {accountsQuery.isSuccess && accounts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <InstagramLogo className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
              No Instagram account connected
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Connect an account to read and reply to your direct messages.
            </p>
            <Link
              href="/api/instagram/connect"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "mt-2",
              )}
            >
              Connect Instagram
            </Link>
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 sm:grid-cols-[300px_1fr]">
            {/* Conversation list. On mobile it takes the full pane and is hidden
                once a thread is open (ManyChat-style); on sm+ it is always
                shown. */}
            <div
              className={`min-h-0 flex-col border-b border-border sm:flex sm:border-b-0 sm:border-r ${
                openConversation ? "hidden" : "flex"
              }`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ChatCircle weight="fill" className="size-4 text-primary" />
                  Conversations
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {conversations.length}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {convLoading ? (
                  <ConversationListSkeleton />
                ) : convError ? (
                  <p className="px-4 py-6 text-sm text-destructive">{convError}</p>
                ) : conversations.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No conversations yet.
                  </p>
                ) : (
                  conversations.map((c) => {
                    const isActive = c.id === activeId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "relative block w-full border-b border-border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "bg-primary/5 hover:bg-primary/5"
                            : "hover:bg-muted/60",
                        )}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                          />
                        )}
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            @{c.contact.username ?? "unknown"}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatTime(c.updatedTime)}
                          </span>
                        </div>
                        {c.lastMessage && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {c.lastMessage.fromMe ? "You: " : ""}
                            {c.lastMessage.text || "(no text)"}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Thread. On mobile it is only shown once a conversation is open
                and fills the pane; on sm+ it always sits beside the list. */}
            <div
              className={`min-h-0 w-[70%] flex-col ${openConversation ? "flex" : "hidden sm:flex"}`}
            >
              {!openConversation ? (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                  Select a conversation to read and reply.
                </div>
              ) : (
                <>
                  <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setActiveId(null)}
                      className="-ml-1 shrink-0 sm:hidden"
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft weight="bold" className="size-4" />
                    </Button>
                    <span className="truncate text-sm font-semibold text-foreground">
                      @{openConversation.contact.username ?? "unknown"}
                    </span>
                  </div>

                  <div
                    ref={scrollRef}
                    className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
                  >
                    {threadLoading && messages.length === 0 ? (
                      <ThreadSkeleton />
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages.</p>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                              m.fromMe
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-muted text-foreground",
                            )}
                          >
                            <p className="whitespace-pre-wrap wrap-break-word">
                              {m.text}
                            </p>
                            <p
                              className={`mt-1 text-[10px] ${
                                m.fromMe
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatTime(m.createdTime)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="shrink-0 border-t border-border p-3">
                    {sendError && (
                      <p className="mb-2 text-xs text-destructive">{sendError}</p>
                    )}
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                        className="max-h-32 min-h-10 flex-1 resize-none rounded-lg bg-muted dark:bg-input/30"
                      />
                      <Button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={sending || !draft.trim()}
                        className="shrink-0"
                      >
                        {sending ? (
                          "Sending…"
                        ) : (
                          <>
                            <PaperPlaneTilt
                              data-icon="inline-start"
                              weight="fill"
                              className="size-4"
                            />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
