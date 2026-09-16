import { prisma } from "@/lib/db/client";
import { decryptToken } from "@/lib/meta/oauth";
import { isAiProvider } from "./providers";
import { AiReplyError } from "./errors";

/** Server/worker only. Never serialize or cache the returned credential. */
export async function loadAiConnection(workspaceId: string, provider: string | null, model: string | null) {
  if (!isAiProvider(provider) || !model?.trim()) {
    throw new AiReplyError("Select an AI provider and model in Inbox Automations.");
  }
  const row = await prisma.aiProviderCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
    select: { encryptedApiKey: true },
  });
  if (!row) throw new AiReplyError("No workspace API key for the selected provider. Ask the workspace owner to connect it.");
  try {
    const apiKey = decryptToken(row.encryptedApiKey);
    if (!apiKey.trim()) throw new Error();
    return { provider, model: model.trim(), apiKey };
  } catch {
    throw new AiReplyError("Cannot decrypt the workspace API key. Check the shared ENCRYPTION_KEY or reconnect the provider.");
  }
}
