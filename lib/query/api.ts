"use client";

/**
 * Small client-side fetch helpers + shared types for TanStack Query fetchers.
 *
 * The dashboard API routes all return `{ success, data, ...meta }`; `success:
 * false` means an error was surfaced in `error`. These helpers unwrap that
 * shape so query functions can `throw` on failure and let TanStack Query manage
 * error/retry state.
 */

export async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("success" in payload) ||
    !(payload as { success: boolean }).success
  ) {
    throw new Error(
      (payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: string }).error
        : undefined) ?? `Request failed (${res.status})`
    );
  }
  return payload as T;
}

export async function getData<T>(url: string): Promise<T> {
  const payload = await fetchApi<{ data: T }>(url);
  return payload.data;
}

export interface AccountOption {
  id: string;
  username: string;
  instagramId: string;
  name?: string | null;
}

export interface AccountList {
  instagramAccounts: AccountOption[];
  selectedInstagramAccountId: string | null;
}

export const fetchAccountList = () =>
  getData<AccountList>("/api/instagram/accounts");

export interface InstagramProfile {
  profilePictureUrl?: string | null;
}

export const fetchProfile = (accountId: string) =>
  getData<InstagramProfile>(
    `/api/instagram/profile?instagramAccountId=${encodeURIComponent(accountId)}`
  );

export interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

export interface SnapshotInfo {
  status?: string;
  fetchedAt?: string;
}

export function postsUrl(
  accountId: string | null | undefined,
  opts: { all?: boolean; limit?: number; refresh?: boolean } = {}
): string {
  const params = new URLSearchParams();
  if (accountId) params.set("instagramAccountId", accountId);
  if (opts.all) params.set("all", "true");
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.refresh) params.set("refresh", "true");
  const q = params.toString();
  return q ? `/api/instagram/posts?${q}` : "/api/instagram/posts";
}

export function fetchPosts(
  accountId: string | null | undefined,
  opts: { all?: boolean; limit?: number; refresh?: boolean } = {}
) {
  return fetchApi<{ data: InstagramPost[]; snapshot?: SnapshotInfo | null }>(
    postsUrl(accountId, opts)
  );
}

export interface ConversationListItem {
  id: string;
  contact: { id: string; username: string | null };
  updatedTime: string | null;
  lastMessage: {
    text: string;
    fromMe: boolean;
    createdTime: string | null;
  } | null;
}

export interface ConversationsResponse {
  conversations: ConversationListItem[];
  account: { id: string; username: string; instagramId: string };
}

export const fetchConversations = (accountId: string) =>
  getData<ConversationsResponse>(
    `/api/instagram/conversations?instagramAccountId=${encodeURIComponent(accountId)}`
  );

export interface ThreadMessage {
  id: string;
  text: string;
  fromMe: boolean;
  fromUsername: string | null;
  createdTime: string | null;
}

export const fetchThreadMessages = (
  accountId: string,
  conversationId: string
) =>
  getData<{ messages: ThreadMessage[] }>(
    `/api/instagram/conversations/${encodeURIComponent(conversationId)}?instagramAccountId=${encodeURIComponent(accountId)}`
  );

export function sendDirectMessageApi(input: {
  instagramAccountId: string;
  recipientId: string;
  text: string;
}): Promise<{ success: boolean; data: unknown; error?: string; code?: string }> {
  return fetch("/api/instagram/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(async (res) => {
    const payload = await res.json();
    if (!payload.success) {
      const err = new Error(payload.error ?? "Failed to send message");
      // Preserve the server's machine-readable code (e.g. WINDOW_CLOSED) so
      // the inbox UI can branch on it without parsing the human message.
      if (payload.code) (err as Error & { code?: string }).code = payload.code;
      if (payload.details) (err as Error & { details?: string }).details = payload.details;
      throw err;
    }
    return payload;
  });
}

export interface UsedPostInfo {
  id: string;
  name: string;
  postId: string;
  instagramAccountId: string;
}

export const fetchUsedPosts = (accountId: string | null | undefined) => {
  const qs = accountId
    ? `?fields=used-posts&instagramAccountId=${encodeURIComponent(accountId)}`
    : "?fields=used-posts";
  return getData<UsedPostInfo[]>(`/api/automations${qs}`);
};

export interface CampaignDetail {
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

export const fetchCampaignDetail = (id: string) =>
  getData<CampaignDetail>(`/api/automations?id=${encodeURIComponent(id)}`);
