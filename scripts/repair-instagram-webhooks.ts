import "dotenv/config";
import { prisma } from "../lib/db/client";
import { decryptToken } from "../lib/meta/oauth";
import { subscribeInstagramAccountToWebhooks } from "../lib/meta/client";
import { getMetaGraphApiVersion } from "../lib/env";

// Dry-run by default. --apply updates existing accounts without disconnecting
// them or dropping any additional webhook fields already subscribed.
async function main() {
  const apply = process.argv.includes("--apply");
  const accounts = await prisma.instagramAccount.findMany({
    where: { accessToken: { not: "" } },
    select: { id: true, instagramId: true, accessToken: true },
  });
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessToken);
      const url = `https://graph.instagram.com/${getMetaGraphApiVersion()}/${account.instagramId}/subscribed_apps`;
      const read = async () => {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15_000),
        });
        const body = await response.json() as {
          data?: Array<{ id: string; subscribed_fields?: string[] }>;
          error?: { code: number };
        };
        if (!response.ok || body.error) throw new Error(`Subscription lookup failed (${body.error?.code ?? response.status})`);
        // Keep this app's fields only; other apps may also be connected.
        const appIds = [process.env.INSTAGRAM_APP_ID, process.env.FACEBOOK_APP_ID].filter(Boolean);
        // Meta can return the parent Meta app ID rather than the Instagram
        // login app ID. A single subscription is unambiguous; multiple
        // unmatched apps require an explicit matching app ID in the env.
        const ownApp = body.data?.find(app => appIds.includes(app.id)) ??
          (body.data?.length === 1 ? body.data[0] : undefined);
        if (!ownApp) throw new Error("This app was not found in the account subscription list");
        return ownApp.subscribed_fields ?? [];
      };
      const fields = await read();
      console.log(JSON.stringify({ accountId: account.id, subscribedFields: fields, apply }));
      if (!apply || fields.includes("messaging_postbacks")) continue;
      const result = await subscribeInstagramAccountToWebhooks(account.instagramId, token, fields);
      if (!result.success) throw new Error("Meta did not confirm the subscription update");
      const verified = await read();
      if (!verified.includes("messaging_postbacks")) throw new Error("Button-click subscription still missing after update");
      console.log(JSON.stringify({ accountId: account.id, verifiedFields: verified }));
    } catch (error) {
      // Never log access tokens or full API responses.
      console.error(JSON.stringify({ accountId: account.id, error: error instanceof Error ? error.message : "Subscription repair failed" }));
      process.exitCode = 1;
    }
  }
}

main().catch((error: unknown) => {
  // Prisma errors can contain connection strings. Show only the error class
  // and structured code when the initial database lookup fails.
  console.error("Unable to load connected accounts", {
    type: error instanceof Error ? error.name : "UnknownError",
    code: error && typeof error === "object" && "code" in error ? error.code : undefined,
  });
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
