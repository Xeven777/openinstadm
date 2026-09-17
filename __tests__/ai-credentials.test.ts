import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { db, context } = vi.hoisted(() => ({
  db: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  context: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ prisma: { aiProviderCredential: db } }));
vi.mock("@/lib/workspace-access", () => ({ getCurrentWorkspaceContext: context }));

import { loadAiConnection } from "@/lib/ai/credentials";
import { encryptToken, decryptToken } from "@/lib/meta/oauth";
import { GET, PUT, DELETE } from "@/app/api/ai-provider-credentials/route";

const request = (method: string, body: unknown) => new NextRequest("http://localhost/api/ai-provider-credentials", { method, body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
  context.mockResolvedValue({ workspaceId: "workspace-a", userId: "owner", role: "OWNER" });
  db.upsert.mockResolvedValue({ provider: "google", updatedAt: new Date(0) });
});
afterEach(() => vi.unstubAllEnvs());

describe("workspace AI credentials", () => {
  it("encrypts additions and rotations, returns only metadata", async () => {
    for (const key of ["first-secret", "rotated-secret"]) {
      const response = await PUT(request("PUT", { workspaceId: "workspace-b", provider: "google", apiKey: key }));
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain(key);
      const query = db.upsert.mock.lastCall![0];
      expect(query.where).toEqual({ workspaceId_provider: { workspaceId: "workspace-a", provider: "google" } });
      expect(query.create.encryptedApiKey).not.toContain(key);
      expect(decryptToken(query.create.encryptedApiKey)).toBe(key);
      expect(decryptToken(query.update.encryptedApiKey)).toBe(key);
      expect(query.select).toEqual({ provider: true, updatedAt: true });
    }
  });

  it("lists metadata only, scoped to the current workspace", async () => {
    db.findMany.mockResolvedValue([{ provider: "google", updatedAt: new Date(0) }]);
    expect((await GET()).status).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a" }, select: { provider: true, updatedAt: true } });
  });

  it("loads and decrypts exactly the workspace/provider pair", async () => {
    db.findUnique.mockResolvedValue({ encryptedApiKey: encryptToken("saved-secret") });
    await expect(loadAiConnection("workspace-b", "deepseek", "custom-model")).resolves.toEqual({ provider: "deepseek", model: "custom-model", apiKey: "saved-secret" });
    expect(db.findUnique).toHaveBeenCalledWith({ where: { workspaceId_provider: { workspaceId: "workspace-b", provider: "deepseek" } }, select: { encryptedApiKey: true } });
  });

  it("reports a missing workspace credential", async () => {
    db.findUnique.mockResolvedValue(null);
    await expect(loadAiConnection("workspace-a", "google", "model")).rejects.toThrow("No workspace API key");
  });

  it("detects ciphertext tampering and a mismatched master key", async () => {
    const ciphertext = encryptToken("saved-secret");
    vi.stubEnv("ENCRYPTION_KEY", "cd".repeat(32));
    db.findUnique.mockResolvedValue({ encryptedApiKey: ciphertext });
    await expect(loadAiConnection("workspace-a", "google", "model")).rejects.toThrow("Cannot decrypt");
    vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
    const bytes = Buffer.from(ciphertext, "base64");
    bytes[bytes.length - 1] ^= 1;
    db.findUnique.mockResolvedValue({ encryptedApiKey: bytes.toString("base64") });
    await expect(loadAiConnection("workspace-a", "google", "model")).rejects.toThrow("Cannot decrypt");
  });

  it("uses different IVs for the same key", () => {
    expect(encryptToken("secret")).not.toEqual(encryptToken("secret"));
  });

  it("removes only the selected provider for the current workspace", async () => {
    expect((await DELETE(request("DELETE", { provider: "google", workspaceId: "workspace-b" }))).status).toBe(200);
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a", provider: "google" } });
  });

  it("rejects members even with campaign and inbox automation permissions", async () => {
    context.mockResolvedValue({ workspaceId: "workspace-a", role: "MEMBER", permissions: ["MANAGE_CAMPAIGNS", "MANAGE_INBOX_AUTOMATIONS", "MANAGE_MEMBERS"] });
    expect((await GET()).status).toBe(403);
    expect((await PUT(request("PUT", { provider: "google", apiKey: "secret" }))).status).toBe(403);
    expect((await DELETE(request("DELETE", { provider: "google" }))).status).toBe(403);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    context.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PUT(request("PUT", {}))).status).toBe(401);
    expect((await DELETE(request("DELETE", {}))).status).toBe(401);
  });

  it("rejects unsupported providers and empty keys", async () => {
    expect((await PUT(request("PUT", { provider: "unknown", apiKey: "secret" }))).status).toBe(400);
    expect((await PUT(request("PUT", { provider: "openai", apiKey: " " }))).status).toBe(400);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("does not return database error details", async () => {
    db.upsert.mockRejectedValue(new Error("query included secret"));
    const response = await PUT(request("PUT", { provider: "google", apiKey: "secret" }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
