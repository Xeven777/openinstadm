import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { encryptToken } from "@/lib/meta/oauth";
import { AI_PROVIDER_IDS } from "@/lib/ai/providers";

const providerSchema = z.object({ provider: z.enum(AI_PROVIDER_IDS) });
const keySchema = providerSchema.extend({ apiKey: z.string().trim().min(1).max(4096) });
const metadata = { provider: true, updatedAt: true } as const;
const headers = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status, headers });

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  try {
    const data = await prisma.aiProviderCredential.findMany({
      where: { workspaceId: context.workspaceId }, select: metadata,
    });
    return NextResponse.json({ success: true, data }, { headers });
  } catch {
    return fail("Unable to load AI connections", 500);
  }
}

export async function PUT(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  if (context.role !== "OWNER") return fail("Only workspace owners can manage AI keys", 403);
  const parsed = keySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Select a supported provider and enter an API key (up to 4096 characters)", 400);
  try {
    const { provider, apiKey } = parsed.data;
    const encryptedApiKey = encryptToken(apiKey);
    const data = await prisma.aiProviderCredential.upsert({
      where: { workspaceId_provider: { workspaceId: context.workspaceId, provider } },
      create: { workspaceId: context.workspaceId, provider, encryptedApiKey },
      update: { encryptedApiKey }, select: metadata,
    });
    return NextResponse.json({ success: true, data }, { headers });
  } catch {
    // Database/crypto errors can contain input parameters. Never log or return them.
    return fail("Unable to save AI connection. Check the server encryption configuration.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  if (context.role !== "OWNER") return fail("Only workspace owners can manage AI keys", 403);
  const parsed = providerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid provider", 400);
  try {
    await prisma.aiProviderCredential.deleteMany({
      where: { workspaceId: context.workspaceId, provider: parsed.data.provider },
    });
    return NextResponse.json({ success: true }, { headers });
  } catch {
    return fail("Unable to remove AI connection", 500);
  }
}
