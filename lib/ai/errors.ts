// Only these deliberately constructed messages may reach browsers or logs.
export class AiReplyError extends Error {}

export function safeAiError(error: unknown): string {
  return error instanceof AiReplyError ? error.message : "AI reply unavailable. Check the provider connection and model.";
}
