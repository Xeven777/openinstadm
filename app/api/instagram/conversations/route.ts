import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/workspace-access";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  getConversations,
  sendDirectMessage,
  MetaApiError,
  MessagingWindowClosedError,
  RateLimitError,
  TokenExpiredError,
  PermissionError,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

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

// List the account's DM conversations for the inbox.
export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected." },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(account.accessToken);
    const raw = await getConversations(accessToken, account.instagramId);

    const conversations: ConversationListItem[] = raw.map((c) => {
      const participants = c.participants?.data ?? [];
      const contact =
        participants.find((p) => p.id !== account.instagramId) ??
        participants[0] ??
        null;
      const last = c.messages?.data?.[0] ?? null;

      return {
        id: c.id,
        contact: {
          id: contact?.id ?? "",
          username: contact?.username ?? null,
        },
        updatedTime: c.updated_time ?? null,
        lastMessage: last
          ? {
              text: last.message ?? "",
              fromMe: last.from?.id === account.instagramId,
              createdTime: last.created_time ?? null,
            }
          : null,
      };
    });

    const data: ConversationsResponse = {
      conversations,
      account: {
        id: account.id,
        username: account.username,
        instagramId: account.instagramId,
      },
    };
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[Conversations] Error:", err);
    const message =
      err instanceof MetaApiError
        ? err.message
        : "Failed to load conversations";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Send a direct message reply.
export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { instagramAccountId?: string; recipientId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const text = body.text?.trim();
  if (!body.recipientId || !text) {
    return NextResponse.json(
      { success: false, error: "A recipient and message are required." },
      { status: 400 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    body.instagramAccountId ?? null
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected." },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(account.accessToken);
    // Try normal send first. If the 24-hour Standard Messaging Window is
    // closed, optionally retry with the HUMAN_AGENT tag (7-day window) when
    // the feature is approved. Opt-in via ENABLE_HUMAN_AGENT_TAG=true so
    // automated sends aren't accidentally flagged as promotional.
    try {
      const result = await sendDirectMessage(
        accessToken,
        account.instagramId,
        body.recipientId,
        text
      );
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      const isWindowClosed =
        err instanceof MessagingWindowClosedError ||
        (err instanceof MetaApiError &&
          /outside of allowed window/i.test(err.message));
      const humanAgentEnabled =
        process.env.ENABLE_HUMAN_AGENT_TAG === "true";

      if (isWindowClosed && humanAgentEnabled) {
        try {
          const retry = await sendDirectMessage(
            accessToken,
            account.instagramId,
            body.recipientId,
            text,
            { tag: "HUMAN_AGENT" }
          );
          return NextResponse.json({ success: true, data: retry });
        } catch (retryErr) {
          // Fall through to the window-closed response below.
          throw retryErr;
        }
      }
      throw err;
    }
  } catch (err) {
    console.error("[Conversations] Send error:", err);

    if (err instanceof MessagingWindowClosedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Instagram closed the 24-hour messaging window for this conversation — the person hasn't messaged you in the last 24 hours. Ask them to send a new message to reopen the window. If your app is approved for the Human Agent feature, set ENABLE_HUMAN_AGENT_TAG=true to extend this to 7 days.",
          code: "WINDOW_CLOSED",
          details: err.message,
        },
        { status: 403 }
      );
    }
    if (err instanceof TokenExpiredError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "RATE_LIMITED" },
        { status: 429 }
      );
    }
    if (err instanceof PermissionError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }
    if (err instanceof MetaApiError) {
      // Fallback: detect window-closed by message even if it wasn't typed as
      // MessagingWindowClosedError (e.g. mocked errors in tests).
      if (/outside of allowed window/i.test(err.message)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Instagram closed the 24-hour messaging window for this conversation — the person hasn't messaged you in the last 24 hours. Ask them to send a new message to reopen the window.",
            code: "WINDOW_CLOSED",
            details: err.message,
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 502 }
      );
    }
    // Generic window text from non-MetaApiError throws (e.g. tests)
    if (err instanceof Error && /outside of allowed window/i.test(err.message)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Instagram closed the 24-hour messaging window for this conversation — the person hasn't messaged you in the last 24 hours. Ask them to send a new message to reopen the window.",
          code: "WINDOW_CLOSED",
          details: err.message,
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 502 }
    );
  }
}
