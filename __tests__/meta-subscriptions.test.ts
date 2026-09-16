import { afterEach, expect, it, vi } from "vitest";
import { subscribeInstagramAccountToWebhooks } from "../lib/meta/client";

afterEach(() => vi.unstubAllGlobals());

it("subscribes button clicks and preserves additional account subscriptions", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
  vi.stubGlobal("fetch", fetchMock);
  await subscribeInstagramAccountToWebhooks("account", "token", ["messaging_seen", "messages"]);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.subscribed_fields).toEqual(["comments", "messages", "messaging_postbacks", "messaging_seen"]);
});
