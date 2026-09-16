/**
 * AI provider client for DM auto-replies.
 *
 * Simplified: single master config per account (AI + fallback), DM-only
 * auto-send. Uses Vercel AI SDK (`ai` + provider) so model/provider are
 * selected explicitly using the workspace's encrypted provider connection.
 *
 * Only one LLM operation now: generateReply grounded by the knowledge
 * textbox. No classify step — that tier was the source of the "Heya for price"
 * bug (keyword shadowed intent). Plain text only, never injects links.
 */

import { generateText, APICallError } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type AiProvider } from "./providers";
import { AiReplyError } from "./errors";

const GENERATE_TIMEOUT_MS = 15_000;
const MAX_REPLY_CHARS = 500;

// Provider warning payloads are untrusted and may include request details.
globalThis.AI_SDK_LOG_WARNINGS = false;

type AiConnection = { provider: AiProvider; model: string; apiKey: string };

export function getModel({ provider, model, apiKey }: AiConnection) {
  if (!apiKey.trim() || !model.trim()) throw new AiReplyError("AI connection and model are required.");
  switch (provider) {
    case "openai": return createOpenAI({ apiKey })(model);
    case "groq": return createGroq({ apiKey })(model);
    case "google": return createGoogleGenerativeAI({ apiKey })(model);
    case "anthropic": return createAnthropic({ apiKey })(model);
    case "deepseek": return createDeepSeek({ apiKey })(model);
    case "openrouter": return createOpenRouter({ apiKey })(model);
    default: throw new AiReplyError("Unsupported AI provider.");
  }
}

async function chatComplete(opts: AiConnection & {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<string> {
  try {
    const result = await generateText({
      model: getModel(opts),
      system: opts.system,
      prompt: opts.user,
      maxOutputTokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      abortSignal: AbortSignal.any([AbortSignal.timeout(opts.timeoutMs), ...(opts.signal ? [opts.signal] : [])]),
      maxRetries: 0,
    });
    return result.text.trim();
  } catch (err) {
    if (APICallError.isInstance(err)) {
      throw new AiReplyError(
        `AI provider request failed (HTTP ${err.statusCode ?? "unknown"}). Check the connection and model.`,
      );
    }
    throw new AiReplyError("AI reply unavailable. Check the provider connection and model.");
  }
}

/**
 * Generate a grounded plain-text reply. `knowledge` is the account's
 * knowledge textbox, injected verbatim as system context (no RAG).
 * `history` is last few thread messages for tone continuity.
 */
export async function generateReply(opts: AiConnection & {
  message: string;
  knowledge: string;
  username: string | null;
  history?: string[];
  signal?: AbortSignal;
}): Promise<{ text: string; model: string }> {
  const knowledgeBlock = opts.knowledge.trim()
    ? `Business info (ground every claim in this; if the answer is not here, say you will connect them with the owner rather than inventing):\n${opts.knowledge.slice(0, 3000)}`
    : `No business info provided. Keep the reply generic and helpful; do not invent prices, links, or policies.`;
  const historyBlock =
    opts.history && opts.history.length > 0
      ? `Recent conversation:\n${opts.history.slice(-5).join("\n").slice(0, 1500)}\n`
      : "";
  const system =
    `You reply as the Instagram business account owner in direct messages. ` +
    `Plain text only, max ${MAX_REPLY_CHARS} characters, no URLs, no markdown, no hashtags. ` +
    `Friendly, concise, one topic. Use the sender's first name sparingly if known. ` +
    `${knowledgeBlock}`;
  const user = `${historyBlock}Sender${opts.username ? ` (@${opts.username})` : ""} wrote: ${opts.message.slice(0, 1000)}`;
  const raw = await chatComplete({
    provider: opts.provider,
    model: opts.model,
    apiKey: opts.apiKey,
    signal: opts.signal,
    system,
    user,
    maxOutputTokens: 220,
    temperature: 0.4,
    timeoutMs: GENERATE_TIMEOUT_MS,
  });
  const text = raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/#{1,}\S+/g, "")
    .trim()
    .slice(0, MAX_REPLY_CHARS);
  if (!text) throw new AiReplyError("AI returned an empty reply.");
  return { text, model: opts.model };
}
