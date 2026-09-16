import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseMessagingInteractions } from "../lib/meta/webhook";

const { mockExecuteRaw, mockFindUnique } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $executeRaw: mockExecuteRaw,
    messagingInteraction: { findUnique: mockFindUnique },
  },
}));

import {
  hasOpenMessagingWindow,
  recordMessagingInteraction,
  MESSAGING_WINDOW_MS,
} from "../lib/meta/messaging-window";

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
});

afterEach(() => vi.useRealTimers());

it("accepts inbound messages (including attachments) and button taps, never reads or echoes", () => {
  const base = { sender: { id: "user" }, timestamp: Date.now() };
  const events = parseMessagingInteractions({ object: "instagram", entry: [{ id: "account", time: 0, messaging: [
    { ...base, message: { mid: "m1", text: "hello" } },
    { ...base, message: { mid: "m2", attachments: [{ type: "image" }] } },
    { ...base, postback: { payload: "followcheck:automation" } },
    { ...base, read: { watermark: Date.now() } },
    { ...base, message: { is_echo: true, text: "echo" } },
    { ...base, sender: { id: "account" }, message: { text: "self" } },
    { ...base, message: { is_deleted: true } },
    { ...base, timestamp: undefined, message: { text: "missing event time" } },
  ] }] });
  expect(events).toHaveLength(3);
  expect(events.every(e => e.timestamp === Date.now() && e.userId === "user")).toBe(true);
});

it("expires eligibility from the interaction time rather than delivery time", async () => {
  const timestamp = Date.now() - 60 * 60_000;
  await recordMessagingInteraction("account", "user", timestamp);
  expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  // A tagged template call is (strings, ...values); the third value is the
  // row's respondedAt, and it is Meta's event time rather than arrival time.
  const now = new Date(), values = mockExecuteRaw.mock.calls[0]!;
  expect(values[1]).toBe("account");
  expect(values[2]).toBe("user");
  expect((values[3] as Date).getTime()).toBe(timestamp);
  expect(now.getTime()).toBeGreaterThan(timestamp);
});

it("does not revive stale or invalid events", async () => {
  for (const time of [Date.now() - MESSAGING_WINDOW_MS, Date.now() + 120_000, NaN, 0]) {
    await recordMessagingInteraction("account", "user", time);
  }
  expect(mockExecuteRaw).not.toHaveBeenCalled();
});

it("requires a recent interaction and leaves a margin before the deadline", async () => {
  mockFindUnique.mockResolvedValue(null);
  expect(await hasOpenMessagingWindow("account", "user")).toBe(false);

  for (const time of [
    Date.now() - MESSAGING_WINDOW_MS,
    Date.now() - MESSAGING_WINDOW_MS + 30_000,
    Date.now() + 1000,
  ]) {
    mockFindUnique.mockResolvedValue({ respondedAt: new Date(time) });
    expect(await hasOpenMessagingWindow("account", "user")).toBe(false);
  }

  mockFindUnique.mockResolvedValue({ respondedAt: new Date(Date.now() - 60_000) });
  expect(await hasOpenMessagingWindow("account", "user")).toBe(true);
});
