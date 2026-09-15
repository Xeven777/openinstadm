/**
 * AI provider client for DM auto-replies.
 *
 * Simplified: single master config per account (AI + fallback), DM-only
 * auto-send. Uses Vercel AI SDK (`ai` + provider) so model/provider are
 * easily swapped via env:
 *   AI_API_KEY (required), AI_PROVIDER=openai|groq, AI_MODEL=gpt-4o-mini
 *
 * Only one LLM operation now: generateReply grounded by the knowledge
 * textbox. No classify step — that tier was the source of the "Heya for price"
 * bug (keyword shadowed intent). Plain text only, never injects links.
 */

import { generateText, APICallError } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { getAIApiKey, getAIModel, getAIProvider } from "@/lib/env";

const GENERATE_TIMEOUT_MS = 15_000;
const MAX_REPLY_CHARS = 500;

function getModel() {
  const apiKey = getAIApiKey();
  if (!apiKey) throw new Error("AI is not configured (AI_API_KEY missing)");
  const provider = getAIProvider();
  const modelName = getAIModel();
  if (provider === "groq") {
    return createGroq({ apiKey })(modelName);
  }
  return createOpenAI({ apiKey })(modelName);
}

async function chatComplete(opts: {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<string> {
  try {
    const result = await generateText({
      model: getModel(),
      system: opts.system,
      prompt: opts.user,
      maxOutputTokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      abortSignal: AbortSignal.timeout(opts.timeoutMs),
      maxRetries: 0,
    });
    return result.text.trim();
  } catch (err) {
    if (APICallError.isInstance(err)) {
      throw new Error(
        `AI provider error ${err.statusCode ?? "?"}: ${(err.responseBody ?? err.message).slice(0, 300)}`,
      );
    }
    throw err;
  }
}

/**
 * Generate a grounded plain-text reply. `knowledge` is the account's
 * knowledge textbox, injected verbatim as system context (no RAG).
 * `history` is last few thread messages for tone continuity.
 */
export async function generateReply(opts: {
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
  return { text, model: getAIModel() };
}