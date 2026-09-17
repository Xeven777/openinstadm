import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { db, context, generate } = vi.hoisted(() => ({
  db: {
    inboxAutomation: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    instagramAccount: { findFirst: vi.fn() },
    aiProviderCredential: { findUnique: vi.fn() },
  },
  context: vi.fn(), generate: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: context,
  getCurrentWorkspaceId: async () => (await context())?.workspaceId,
  canManageInboxAutomations: (ctx: { role: string; permissions?: string[] }) =>
    ctx.role === "OWNER" || ctx.permissions?.includes("MANAGE_INBOX_AUTOMATIONS"),
}));
vi.mock("@/lib/ai/client", () => ({ generateReply: generate }));
vi.mock("@/lib/meta/oauth", () => ({ decryptToken: (value: string) => `decrypted-${value}` }));

import { POST, PATCH, PUT } from "@/app/api/inbox-automations/route";
import { AI_PROVIDER_IDS } from "@/lib/ai/providers";

const config = {
  id: "config-a", workspaceId: "workspace-a", instagramAccountId: "account-a", isActive: true,
  aiEnabled: true, aiProvider: "google", aiModel: "gemini-custom-model", knowledge: "Shop info",
  fallbackKeywords: [], fallbackMessage: "Fallback reply", matchAnyWord: false, wholeWordMatch: true,
};
const request = (method: string, body: unknown) => new NextRequest("http://localhost/api/inbox-automations?id=config-a", { method, body: JSON.stringify(body) });
const preview = () => PUT(request("PUT", { instagramAccountId: "account-a", messageText: "hello" }));

beforeEach(() => {
  vi.resetAllMocks();
  context.mockResolvedValue({ workspaceId: "workspace-a", role: "OWNER" });
  db.inboxAutomation.findFirst.mockResolvedValue({ ...config });
  db.aiProviderCredential.findUnique.mockResolvedValue({ encryptedApiKey: "workspace-key" });
  db.instagramAccount.findFirst.mockResolvedValue({ id: "account-a" });
  db.inboxAutomation.findUnique.mockResolvedValue(null);
  db.inboxAutomation.create.mockImplementation(({ data }) => Promise.resolve(data));
  db.inboxAutomation.update.mockImplementation(({ data }) => Promise.resolve(data));
  generate.mockResolvedValue({ text: "AI reply", model: config.aiModel });
});

describe("inbox AI configuration and playground", () => {
  it.each(AI_PROVIDER_IDS)("saves the exact custom model ID for %s", async (provider) => {
    const model = "vendor/a-very-long-custom-model-name-that-exceeds-the-old-sixty-character-limit:beta";
    const response = await POST(request("POST", { ...config, aiProvider: provider, aiModel: model }));
    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({ aiProvider: provider, aiModel: model, workspaceId: "workspace-a" });
  });

  it("validates enabled provider/model on create and partial updates", async () => {
    expect((await POST(request("POST", { ...config, aiProvider: "bad" }))).status).toBe(400);
    expect((await POST(request("POST", { ...config, aiModel: null }))).status).toBe(400);
    expect((await PATCH(request("PATCH", { aiModel: null }))).status).toBe(400);
    expect((await PATCH(request("PATCH", { aiModel: "custom:exact" }))).status).toBe(200);
    expect(db.inboxAutomation.update).toHaveBeenCalledWith({ where: { id: "config-a" }, data: { aiModel: "custom:exact" } });
  });

  it("uses the saved provider/model and decrypted workspace credential", async () => {
    const response = await preview();
    const data = (await response.json()).data;
    expect(data).toMatchObject({ reply: "AI reply", ai: true });
    expect(data.model).toBeUndefined();
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", model: config.aiModel, apiKey: "decrypted-workspace-key" }));
    expect(db.inboxAutomation.findFirst).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a", instagramAccountId: "account-a", isActive: true } });
  });

  it("uses fallback and reports a missing key without calling AI", async () => {
    db.aiProviderCredential.findUnique.mockResolvedValue(null);
    const data = (await (await preview()).json()).data;
    expect(data).toMatchObject({ reply: "Fallback reply", ai: false });
    expect(data.aiError).toContain("No workspace API key");
    expect(generate).not.toHaveBeenCalled();
  });

  it("uses fallback on provider failure without exposing raw errors", async () => {
    generate.mockRejectedValue(new Error("secret-key in provider error"));
    const result = await (await preview()).json();
    expect(result.data).toMatchObject({ reply: "Fallback reply", ai: false });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("honors fallback keyword gates and reports errors even without a reply", async () => {
    db.inboxAutomation.findFirst.mockResolvedValue({ ...config, fallbackKeywords: ["pricing"] });
    db.aiProviderCredential.findUnique.mockResolvedValue(null);
    expect((await (await preview()).json()).data).toMatchObject({ matched: null, reply: null, aiError: expect.any(String) });
  });

  it("skips credential access when AI is disabled", async () => {
    db.inboxAutomation.findFirst.mockResolvedValue({ ...config, aiEnabled: false });
    expect((await (await preview()).json()).data.reply).toBe("Fallback reply");
    expect(db.aiProviderCredential.findUnique).not.toHaveBeenCalled();
  });

  it("does not preview another workspace's account", async () => {
    db.inboxAutomation.findFirst.mockResolvedValue(null);
    expect((await (await preview()).json()).data.reply).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("allows inbox managers to edit reply content and use the playground, but not AI configuration", async () => {
    context.mockResolvedValue({ workspaceId: "workspace-a", role: "MEMBER", permissions: ["MANAGE_INBOX_AUTOMATIONS"] });
    expect((await PATCH(request("PATCH", { knowledge: "Updated shop information" }))).status).toBe(200);
    expect(db.inboxAutomation.update).toHaveBeenCalledWith({
      where: { id: "config-a" },
      data: { knowledge: "Updated shop information" },
    });
    expect((await PATCH(request("PATCH", { aiModel: "different-model" }))).status).toBe(403);

    const data = (await (await preview()).json()).data;
    expect(data).toMatchObject({ reply: "AI reply", ai: true });
    expect(data.model).toBeUndefined();
  });

  it("requires inbox automation management permission to use the playground", async () => {
    context.mockResolvedValue({ workspaceId: "workspace-a", role: "MEMBER" });
    expect((await preview()).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });
});
