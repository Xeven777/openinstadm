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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gooeyToast } from "goey-toast";
import {
  ArrowDown,
  ArrowLeft,
  ChatCircle,
  InstagramLogo,
  MagnifyingGlass,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { canManageInstagramAccounts, useWorkspaceContext } from "@/lib/workspace-context";

const POLL_MS = 20_000;
// The seeded account is remembered in sessionStorage so a revisit can start on
// the right account before the account list resolves.
const SELECTED_ACCOUNT_KEY = "inbox:selectedAccount";

function formatTime(iso: string | null, nowMs: number | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // nowMs comes from state (effect) so this function stays pure during render.
  // Fallback to date-only when now is not yet available (first render).
  if (nowMs == null) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const now = new Date(nowMs);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDayLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toDateString() === db.toDateString();
}

function avatarUrl(contactId: string): string {
  return `https://api.dicebear.com/10.x/moods/svg?seed=${encodeURIComponent(contactId)}`;
}

function initialOf(username: string | null | undefined): string {
  const c = (username ?? "?").trim().charAt(0).toUpperCase();
  return c || "?";
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-3" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-10" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-2"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-24 self-center rounded-full" />
      <Skeleton className="h-12 w-2/3 rounded-2xl rounded-bl-md" />
      <Skeleton className="h-10 w-1/2 self-end rounded-2xl rounded-br-md" />
      <Skeleton className="h-14 w-3/5 rounded-2xl rounded-bl-md" />
      <Skeleton className="h-10 w-1/3 self-end rounded-2xl rounded-br-md" />
    </div>
  );
}

function ContactAvatar({
  contactId,
  username,
  size = "default",
  className,
}: {
  contactId: string;
  username: string | null | undefined;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size === "sm" ? "sm" : "default"} className={cn(size === "lg" && "size-10", className)}>
      <AvatarImage
        src={avatarUrl(contactId)}
        alt={username ? `@${username}` : "contact"}
        loading="lazy"
      />
      <AvatarFallback>{initialOf(username)}</AvatarFallback>
    </Avatar>
  );
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const canManageAccounts = canManageInstagramAccounts(useWorkspaceContext());
  // Seed from the last-used account so a revisit can paint the cached
  // conversation list immediately, before the account list even loads.
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(SELECTED_ACCOUNT_KEY) ?? "";
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  // Wall-clock for 24-hour window + "same day" labels. Kept in state so
  // render stays pure (cacheComponents rule forbids Date.now()/new Date() in
  // render). Updated once a minute so the "window expired" label flips
  // without a full refetch.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed clock after mount so render is pure
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
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
    setSearch("");
  }, [selectedAccountId]);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.conversations(selectedAccountId),
    queryFn: () =>
      fetchConversations(selectedAccountId).then((r) => r.conversations),
    enabled: Boolean(selectedAccountId),
    refetchInterval: POLL_MS,
  });
  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data],
  );
  const convLoading = conversationsQuery.isPending;
  const convError = conversationsQuery.error
    ? conversationsQuery.error.message
    : null;

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.contact.username ?? "").toLowerCase();
      const preview = (c.lastMessage?.text ?? "").toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, search]);

  const messagesQuery = useQuery({
    queryKey: queryKeys.messages(selectedAccountId, activeId ?? ""),
    queryFn: () =>
      fetchThreadMessages(selectedAccountId, activeId!).then((r) => r.messages),
    enabled: Boolean(selectedAccountId && activeId),
    refetchInterval: POLL_MS,
  });
  const messages = useMemo(
    () => messagesQuery.data ?? [],
    [messagesQuery.data],
  );
  const threadLoading = messagesQuery.isPending;

  const openConversation = conversations.find((c) => c.id === activeId) ?? null;

  // Instagram's Standard Messaging Window: 24 hours from the user's last
  // inbound message. We derive the last inbound time from the loaded thread;
  // fallback to the conversation's updated_time (proxy for last activity).
  // Uses nowMs from state so the memo stays pure for cacheComponents.
  const windowInfo = useMemo(() => {
    if (!openConversation) return null;
    let lastInboundIso: string | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].fromMe && messages[i].createdTime) {
        lastInboundIso = messages[i].createdTime;
        break;
      }
    }
    const iso = lastInboundIso ?? openConversation.updatedTime;
    if (!iso) return { closed: false as const, unknown: true as const };
    const t = Date.parse(iso);
    if (Number.isNaN(t))
      return { closed: false as const, unknown: true as const };
    if (nowMs == null)
      return { closed: false as const, unknown: true as const };
    const elapsedMs = nowMs - t;
    const closed = elapsedMs > 24 * 60 * 60 * 1000;
    const hoursLeft = Math.max(0, 24 - elapsedMs / 3600000);
    return { closed, unknown: false as const, iso, elapsedMs, hoursLeft };
  }, [messages, openConversation, nowMs]);

  const isWindowClosed = windowInfo && !windowInfo.unknown && windowInfo.closed;
  const windowWarning = useMemo(() => {
    if (!isWindowClosed) return null;
    return "Instagram's 24-hour window is closed — this person hasn't messaged you in the last 24 hours, so Meta will reject the send. Ask them to send a new message to reopen it (or enable the 7-day Human Agent tag after App Review).";
  }, [isWindowClosed]);

  // Smart autoscroll: stay pinned only when already near the bottom, so
  // reading history isn't yanked away by polls. Expose a "jump to latest"
  // pill when the user scrolls up.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distance < 120);
  }, []);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, stickToBottom, activeId]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setStickToBottom(true);
  }, []);

  // Reset pin when opening a different thread.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on thread change
    setStickToBottom(true);
  }, [activeId]);

  // Auto-grow the composer up to its max height.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

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
      // Date calls are inside an event handler (mutation), not render.
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
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setSendError(msg);
      if (/24-hour|WINDOW_CLOSED|outside of allowed window/i.test(msg)) {
        gooeyToast.error("Window closed — they need to message you again");
      } else {
        gooeyToast.error("Message not sent");
      }
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

  const recipientId = openConversation?.contact.id;

  async function handleSend() {
    const text = draft.trim();
    if (!text || !recipientId || sendMutation.isPending) return;
    setSendError(null);
    setDraft("");
    setStickToBottom(true);
    await sendMutation.mutateAsync({
      recipientId,
      text,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setSendError(null);
    setStickToBottom(true);
  }, []);

  const sending = sendMutation.isPending;
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

      <Card className="h-[calc(100svh-16rem)] max-h-[880px] min-h-[480px] gap-0 overflow-hidden py-0 sm:h-[calc(100dvh-13rem)]">
        {accountsQuery.isSuccess && accounts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <InstagramLogo className="size-6" />
            </span>
            <p className="text-sm font-medium text-foreground">
              No Instagram account connected
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Connect an account to read and reply to your direct messages.
            </p>
            {canManageAccounts && <Link
              href="/api/instagram/connect"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "mt-2",
              )}
            >
              Connect Instagram
            </Link>}
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
            {/* Conversation list */}
            <div
              className={cn(
                "h-full min-h-0 flex-col border-border md:flex md:border-r",
                openConversation ? "hidden" : "flex",
              )}
            >
              <div className="shrink-0 space-y-2.5 border-b border-border px-3 py-3 sm:px-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ChatCircle weight="fill" className="size-4 text-primary" />
                    Conversations
                  </span>
                  <Badge variant="muted" className="tabular-nums">
                    {conversations.length}
                  </Badge>
                </div>
                <div className="relative">
                  <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search people or messages…"
                    aria-label="Search conversations"
                    className="h-9 bg-muted/60 pr-3 pl-9 text-sm placeholder:text-muted-foreground/80 focus-visible:bg-background"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {convLoading ? (
                  <ConversationListSkeleton />
                ) : convError ? (
                  <p className="px-4 py-6 text-sm text-destructive">
                    {convError}
                  </p>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <ChatCircle className="size-5" />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      No conversations yet
                    </p>
                    <p className="max-w-55 text-xs text-muted-foreground">
                      When someone replies to your automation DM, it will show
                      up here.
                    </p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No matches for “{search.trim()}”.
                  </p>
                ) : (
                  <ul className="p-1.5 sm:p-2">
                    {filteredConversations.map((c) => {
                      const isActive = c.id === activeId;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(c.id)}
                            aria-current={isActive ? "true" : undefined}
                            className={cn(
                              "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors sm:px-3",
                              isActive
                                ? "bg-primary/10 hover:bg-primary/10"
                                : "hover:bg-muted/70 active:bg-muted",
                            )}
                          >
                            <span className="relative shrink-0">
                              <ContactAvatar
                                contactId={c.contact.id}
                                username={c.contact.username}
                              />
                              {isActive && (
                                <span
                                  aria-hidden="true"
                                  className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-primary"
                                />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-sm font-medium text-foreground">
                                  @{c.contact.username ?? "unknown"}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                  {formatTime(c.updatedTime, nowMs)}
                                </span>
                              </span>
                              {c.lastMessage ? (
                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                  {c.lastMessage.fromMe ? "You: " : ""}
                                  {c.lastMessage.text || "(no text)"}
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-xs text-muted-foreground/70 italic">
                                  No messages yet
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Thread. On mobile it is only shown once a conversation is open
                and fills the pane; on md+ it always sits beside the list. */}
            <div
              className={cn(
                "h-full min-h-0 w-full min-w-0 flex-col bg-background",
                openConversation ? "flex" : "hidden md:flex",
              )}
            >
              {!openConversation ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <ChatCircle weight="duotone" className="size-6" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    Select a conversation
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Pick someone from the list to read the full thread and
                    reply. New DMs arrive automatically.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-background/80 px-3 py-2.5 sm:px-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setActiveId(null)}
                      className="-ml-1 shrink-0 md:hidden"
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft weight="bold" className="size-4" />
                    </Button>
                    <ContactAvatar
                      contactId={openConversation.contact.id}
                      username={openConversation.contact.username}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        @{openConversation.contact.username ?? "unknown"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {messages.length > 0
                          ? `${messages.length} message${messages.length === 1 ? "" : "s"} · updated ${formatTime(openConversation.updatedTime, nowMs)}`
                          : "No messages yet"}
                      </p>
                    </div>
                    {isWindowClosed ? (
                      <Badge variant="warning" className="shrink-0">
                        Window closed
                      </Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0">
                        Open
                      </Badge>
                    )}
                  </div>

                  <div className="relative min-h-0 flex-1">
                    <div
                      ref={scrollRef}
                      onScroll={handleScroll}
                      role="log"
                      aria-live="polite"
                      aria-label="Message history"
                      className="h-full overflow-y-auto overscroll-contain scroll-smooth px-3 py-4"
                    >
                      {threadLoading && messages.length === 0 ? (
                        <ThreadSkeleton />
                      ) : messages.length === 0 ? (
                        <p className="mx-auto w-fit rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                          No messages in this thread yet.
                        </p>
                      ) : (
                        <div className="mx-auto flex w-full max-w-2xl flex-col">
                          {messages.map((m, i) => {
                            const prev = i > 0 ? messages[i - 1] : null;
                            const showDay =
                              !prev || !isSameDay(prev.createdTime, m.createdTime);
                            const grouped =
                              !!prev &&
                              prev.fromMe === m.fromMe &&
                              !showDay;
                            return (
                              <div key={m.id} className="contents">
                                {showDay && (
                                  <div className="mt-1 mb-2 flex justify-center first:mt-0">
                                    <span className="rounded-full text-[10px] text-muted-foreground">
                                      {formatDayLabel(m.createdTime)}
                                    </span>
                                  </div>
                                )}
                                <div
                                  className={cn(
                                    "flex w-full",
                                    m.fromMe ? "justify-end" : "justify-start",
                                    grouped ? "mt-0.5" : "mt-2.5",
                                  )}
                                >
                                  {!m.fromMe && (
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "mr-2 shrink-0 self-end",
                                        grouped ? "invisible" : "visible",
                                      )}
                                    >
                                      <ContactAvatar
                                        contactId={openConversation.contact.id}
                                        username={openConversation.contact.username}
                                        size="sm"
                                        className="size-6"
                                      />
                                    </span>
                                  )}
                                  <div
                                    className={cn(
                                      "max-w-[85%] min-w-0 px-3.5 py-2 text-sm leading-relaxed break-words shadow-xs sm:max-w-[75%]",
                                      m.fromMe
                                        ? "rounded-2xl rounded-br-xs bg-primary text-primary-foreground"
                                        : "rounded-2xl rounded-bl-xs border border-border/60 bg-muted/80 text-foreground",
                                      m.id.startsWith("optimistic-") &&
                                        "opacity-70",
                                    )}
                                  >
                                    <p className="whitespace-pre-wrap wrap-break-word">
                                      {m.text}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-right text-[10px] tabular-nums",
                                        m.fromMe
                                          ? "text-primary-foreground/70"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {formatTime(m.createdTime, nowMs)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {!stickToBottom && messages.length > 0 && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={scrollToBottom}
                          className="pointer-events-auto rounded-full shadow-md"
                        >
                          <ArrowDown weight="bold" className="size-3.5" />
                          Latest
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-border bg-background px-3 pt-2.5 pb-3 sm:px-4 sm:pb-4">
                    {isWindowClosed && (
                      <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                        {windowWarning}
                      </div>
                    )}
                    {sendError && (
                      <p className="mb-2 text-xs text-destructive" role="alert">
                        {sendError}
                      </p>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 rounded-2xl border border-input bg-muted/50 transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/20">
                        <Textarea
                          ref={composerRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={handleKeyDown}
                          rows={1}
                          placeholder={
                            isWindowClosed
                              ? "Window closed — ask them to message again…"
                              : "Write a reply…"
                          }
                          aria-label="Message reply"
                          className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-3.5 py-2.5 shadow-none focus-visible:ring-0"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!canSend}
                        size="icon"
                        aria-label={sending ? "Sending…" : "Send message"}
                        title={
                          isWindowClosed
                            ? "Instagram will reject this until the person messages again (24h window closed)"
                            : "Send (Enter)"
                        }
                        className="size-10 shrink-0 rounded-full"
                      >
                        {sending ? (
                          <span
                            aria-hidden="true"
                            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          />
                        ) : (
                          <PaperPlaneTilt
                            weight="fill"
                            className="size-4"
                          />
                        )}
                      </Button>
                    </div>
                    <p className="mt-1.5 hidden px-1 text-[11px] text-muted-foreground sm:block">
                      Enter to send · Shift+Enter for a new line
                      {isWindowClosed &&
                        windowInfo &&
                        !windowInfo.unknown &&
                        ` · Last inbound: ${formatTime(windowInfo.iso, nowMs)}`}
                    </p>
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
