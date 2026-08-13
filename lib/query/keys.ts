"use client";

/**
 * Central TanStack Query key factory. Keeping keys here means a mutation can
 * invalidate the right queries (e.g. after sending a DM we bump both the
 * conversations list and the active thread) without scattering key literals
 * across components.
 */

export const queryKeys = {
  accounts: ["instagram", "accounts"] as const,
  profile: (accountId: string) => ["instagram", "profile", accountId] as const,
  posts: (
    accountId: string | null | undefined,
    opts: { all?: boolean; limit?: number } = {}
  ) =>
    [
      "instagram",
      "posts",
      accountId ?? "default",
      opts.all ? "all" : "recent",
      opts.limit ?? "default",
    ] as const,
  conversations: (accountId: string) =>
    ["inbox", "conversations", accountId] as const,
  messages: (accountId: string, conversationId: string) =>
    ["inbox", "messages", accountId, conversationId] as const,
  media: (accountIds: readonly string[]) =>
    ["ig-media", accountIds.join(",")] as const,
};
