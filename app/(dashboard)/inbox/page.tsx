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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AccountSelect, { type AccountOption } from "@/components/account-select";
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
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
          />
        )}
      </div>

      <div className="grid h-[calc(100dvh-11rem)] grid-cols-1 overflow-hidden rounded border border-border sm:grid-cols-[300px_1fr]">
        {/* Conversation list. On mobile it takes the full pane and is hidden
            once a thread is open (ManyChat-style); on sm+ it is always shown. */}
        <div
          className={`min-h-0 flex-col border-b border-border sm:flex sm:border-b-0 sm:border-r ${
            openConversation ? "hidden" : "flex"
          }`}
        >
          <div className="shrink-0 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            Conversations
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Loading…
              </p>
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
                    className={`block w-full border-b border-border px-4 py-3 text-left ${
                      isActive ? "bg-muted" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        @{c.contact.username ?? "unknown"}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-500">
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

        {/* Thread. On mobile it is only shown once a conversation is open and
            fills the pane; on sm+ it always sits beside the list. */}
        <div
          className={`min-h-0 flex-col w-[70%] ${openConversation ? "flex" : "hidden sm:flex"}`}
        >
          {!openConversation ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="-ml-1 rounded px-2 py-1 text-muted-foreground hover:text-foreground sm:hidden"
                  aria-label="Back to conversations"
                >
                  Back
                </button>
                <span className="truncate">
                  @{openConversation.contact.username ?? "unknown"}
                </span>
              </div>

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
              >
                {threadLoading && messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          m.fromMe
                            ? "bg-accent text-white"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        <p className="whitespace-pre-wrap wrap-break-word">
                          {m.text}
                        </p>
                        <p
                          className={`mt-1 text-[10px] ${
                            m.fromMe ? "text-white/70" : "text-zinc-500"
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
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                    className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
