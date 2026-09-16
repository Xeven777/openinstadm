import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError } from "ai";

vi.mock("ai", async (original) => ({ ...await original<typeof import("ai")>(), generateText: vi.fn() }));

import { generateText } from "ai";
import { generateReply, getModel } from "@/lib/ai/client";
import { AI_PROVIDER_IDS } from "@/lib/ai/providers";

const generate = vi.mocked(generateText);
const input = { provider: "openai" as const, model: "gpt-4.1-mini", apiKey: "test-secret", message: "Hi", knowledge: "", username: null };

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("AI adapters", () => {
  it.each(AI_PROVIDER_IDS)("selects %s and preserves a custom model ID", (provider) => {
    const model = getModel({ provider, model: "custom/vendor-model:beta", apiKey: "workspace-secret" });
    expect(model.modelId).toBe("custom/vendor-model:beta");
    expect(model.provider).toContain(provider === "google" ? "google" : provider);
  });

  it.each(AI_PROVIDER_IDS)("authenticates %s with the supplied workspace key", async (provider) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "test rejection" } }), { status: 400, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const model = getModel({ provider, model: "custom-model", apiKey: "workspace-secret" });
    await Promise.resolve(model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }] })).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledOnce();
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    const name = provider === "google" ? "x-goog-api-key" : provider === "anthropic" ? "x-api-key" : "authorization";
    expect(headers.get(name)).toBe(name === "authorization" ? "Bearer workspace-secret" : "workspace-secret");
  });

  it("uses explicit model selection and sanitizes the generated reply", async () => {
    generate.mockResolvedValue({ text: "Hi! https://example.com #offer" } as Awaited<ReturnType<typeof generateText>>);
    await expect(generateReply(input)).resolves.toEqual({ text: "Hi!", model: "gpt-4.1-mini" });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ model: expect.objectContaining({ modelId: "gpt-4.1-mini" }), maxRetries: 0 }));
  });

  it("does not use an environment credential when the explicit key is empty", () => {
    expect(() => getModel({ ...input, apiKey: "" })).toThrow("connection and model are required");
  });

  it("rejects unknown providers instead of silently using OpenAI", () => {
    expect(() => getModel({ ...input, provider: "unknown" as never })).toThrow("Unsupported");
  });

  it.each(["", "https://example.com", "   "])("rejects empty usable output: %j", async (text) => {
    generate.mockResolvedValue({ text } as Awaited<ReturnType<typeof generateText>>);
    await expect(generateReply(input)).rejects.toThrow("empty reply");
  });

  it("never exposes provider response bodies or raw exceptions", async () => {
    generate.mockRejectedValue(new APICallError({ message: "test-secret", url: "https://example.com", requestBodyValues: {}, statusCode: 401, responseBody: "test-secret" }));
    await expect(generateReply(input)).rejects.toThrow("HTTP 401");
    generate.mockRejectedValue(new Error("test-secret"));
    await expect(generateReply(input)).rejects.toThrow("AI reply unavailable");
  });
});
