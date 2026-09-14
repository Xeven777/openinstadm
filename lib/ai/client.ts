/**
 * AI provider client for DM auto-replies.
 *
 * Global-key, DM-only, auto-send. Uses the Vercel AI SDK (`ai` + `@ai-sdk/groq`)
 * instead of a raw fetch call. Model + key come from env:
 *   AI_API_KEY (required to enable), AI_MODEL (e.g. "llama-3.3-70b-versatile").
 *
 * Two operations:
 *  - classifyIntent: cheap small call returning one of the known intents or "none"
 *  - generateReply: grounded reply using the rule's knowledge textbox as the
 *    system context. Plain text only — never injects tracked links (per spec).
 */

import { generateText, APICallError } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getAIApiKey, getAIModel } from "@/lib/env";

const CLASSIFY_TIMEOUT_MS = 8_000;
const GENERATE_TIMEOUT_MS = 15_000;
const MAX_REPLY_CHARS = 500;

export interface AIClassifyResult {
  intent: string; // intent name or "none"
  confidence: number; // 0..1 heuristic
}

async function chatComplete(opts: {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<string> {
  const apiKey = getAIApiKey();
  if (!apiKey) throw new Error("AI is not configured (AI_API_KEY missing)");
  const groq = createGroq({ apiKey });
  try {
    const result = await generateText({
      model: groq(getAIModel()),
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
 * Classify a DM into one of `intents` (rule aiIntent names) or "none".
 * Keeps the prompt tiny so this stays cheap.
 */
export async function classifyIntent(
  message: string,
  intents: string[],
): Promise<AIClassifyResult> {
  if (intents.length === 0) return { intent: "none", confidence: 0 };
  const system =
    `You are a DM intent classifier. Allowed intents: ${intents.join(", ")}. ` +
    `Respond with ONLY the intent name, or "none" if no intent matches. No punctuation, no explanation.`;
  const raw = await chatComplete({
    system,
    user: message.slice(0, 1000),
    maxOutputTokens: 20,
    temperature: 0,
    timeoutMs: CLASSIFY_TIMEOUT_MS,
  });
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_ ]/g, "");
  const hit = intents.find((i) => i.toLowerCase() === cleaned);
  if (hit) return { intent: hit, confidence: 0.9 };
  if (cleaned === "none" || cleaned === "")
    return { intent: "none", confidence: 0.9 };
  // Fuzzy: provider returned something close — treat as low-confidence none
  // rather than hallucinating a rule match.
  return { intent: "none", confidence: 0.4 };
}

/**
 * Generate a grounded plain-text reply. `knowledge` is the rule's knowledge
 * textbox, injected verbatim as the system context (no RAG in v1).
 * `history` is the last few thread messages for tone continuity.
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
  // Guardrails: plain text, bounded, no links (per spec: AI never injects links).
  const text = raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/#{1,}\S+/g, "")
    .trim()
    .slice(0, MAX_REPLY_CHARS);
  return { text, model: getAIModel() };
}
