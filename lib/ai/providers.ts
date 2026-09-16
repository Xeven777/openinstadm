// Safe to import in the dashboard: no credentials or provider SDKs here.
export const AI_PROVIDER_IDS = ["openai", "groq", "google", "anthropic", "deepseek", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDER_IDS)[number];

export const AI_PROVIDERS: Record<AiProvider, { label: string; models: { id: string; label: string }[] }> = {
  openai: { label: "OpenAI", models: [
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ] },
  groq: { label: "Groq", models: [
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
  ] },
  google: { label: "Google Gemini", models: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  ] },
  anthropic: { label: "Anthropic", models: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  ] },
  deepseek: { label: "DeepSeek", models: [
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ] },
  openrouter: { label: "OpenRouter", models: [
    { id: "openai/gpt-4o-mini", label: "OpenAI / GPT-4o mini" },
    { id: "google/gemini-2.5-flash", label: "Google / Gemini 2.5 Flash" },
    { id: "anthropic/claude-sonnet-4.6", label: "Anthropic / Claude Sonnet 4.6" },
  ] },
};

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && AI_PROVIDER_IDS.includes(value as AiProvider);
}
