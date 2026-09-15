import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageAutomations,
  getCurrentWorkspaceContext,
  getCurrentWorkspaceId,
} from "@/lib/workspace-access";
import { generateReply } from "@/lib/ai/client";
import { isAIEnabled } from "@/lib/env";

// One master config per Instagram account: AI + fallback only.
const baseFields = {
  instagramAccountId: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  aiEnabled: z.boolean().optional().default(false),
  knowledge: z.string().max(4000).optional().nullable(),
  aiProvider: z.string().max(30).optional().nullable(),
  aiModel: z.string().max(60).optional().nullable(),
  fallbackKeywords: z.array(z.string().min(1).max(50)).max(10).optional().default([]),
  fallbackMessage: z.string().max(1000).optional().default(""),
  wholeWordMatch: z.boolean().optional().default(true),
  matchAnyWord: z.boolean().optional().default(false),
};

const createSchema = z.object(baseFields);

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  knowledge: z.string().max(4000).optional().nullable(),
  aiProvider: z.string().max(30).optional().nullable(),
  aiModel: z.string().max(60).optional().nullable(),
  fallbackKeywords: z.array(z.string().min(1).max(50)).max(10).optional(),
  fallbackMessage: z.string().max(1000).optional(),
  wholeWordMatch: z.boolean().optional(),
  matchAnyWord: z.boolean().optional(),
});

async function assertAccount(workspaceId: string, instagramAccountId: string) {
  return prisma.instagramAccount.findFirst({
    where: { id: instagramAccountId, workspaceId },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  const instagramAccountId = request.nextUrl.searchParams.get("instagramAccountId");

  if (id) {
    const row = await prisma.inboxAutomation.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { dmLogs: true } } },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const sent = await prisma.dmLog.count({ where: { inboxAutomationId: id, status: "SENT" } });
    return NextResponse.json(
      { success: true, data: { ...row, stats: { total: row._count.dmLogs, sent } } },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const rows = await prisma.inboxAutomation.findMany({
    where: {
      workspaceId,
      ...(instagramAccountId ? { instagramAccountId } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      instagramAccount: { select: { id: true, username: true } },
      _count: { select: { dmLogs: true } },
    },
  });
  return NextResponse.json(
    { success: true, data: rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAutomations(context)) {
    return NextResponse.json({ success: false, error: "No permission" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const account = await assertAccount(context.workspaceId, parsed.data.instagramAccountId);
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
  }
  const existing = await prisma.inboxAutomation.findUnique({
    where: { instagramAccountId: parsed.data.instagramAccountId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "This account already has an inbox config — edit it instead" },
      { status: 409 }
    );
  }

  const created = await prisma.inboxAutomation.create({
    data: {
      workspaceId: context.workspaceId,
      instagramAccountId: parsed.data.instagramAccountId,
      isActive: parsed.data.isActive,
      aiEnabled: parsed.data.aiEnabled,
      knowledge: parsed.data.knowledge?.trim() || null,
      aiProvider: parsed.data.aiProvider?.trim() || null,
      aiModel: parsed.data.aiModel?.trim() || null,
      fallbackKeywords: parsed.data.matchAnyWord ? [] : parsed.data.fallbackKeywords,
      fallbackMessage: parsed.data.fallbackMessage ?? "",
      wholeWordMatch: parsed.data.wholeWordMatch,
      matchAnyWord: parsed.data.matchAnyWord,
    },
  });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAutomations(context)) {
    return NextResponse.json({ success: false, error: "No permission" }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const existing = await prisma.inboxAutomation.findFirst({
    where: { id, workspaceId: context.workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const data = { ...parsed.data } as Record<string, unknown>;
  if (parsed.data.matchAnyWord === true) data.fallbackKeywords = [];
  if (parsed.data.knowledge !== undefined) data.knowledge = (parsed.data.knowledge as string)?.trim() || null;
  if (parsed.data.fallbackMessage !== undefined) data.fallbackMessage = parsed.data.fallbackMessage ?? "";
  const updated = await prisma.inboxAutomation.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAutomations(context)) {
    return NextResponse.json({ success: false, error: "No permission" }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }
  const existing = await prisma.inboxAutomation.findFirst({
    where: { id, workspaceId: context.workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  await prisma.inboxAutomation.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: true } });
}

// --- Preview / playground ----------------------------------------------------
// PUT /api/inbox-automations { instagramAccountId, messageText }
// Returns simulated reply: AI first if enabled, else fallback gated by keywords.
const previewSchema = z.object({
  instagramAccountId: z.string().min(1),
  messageText: z.string().min(1).max(1000),
});

export async function PUT(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const config = await prisma.inboxAutomation.findFirst({
    where: { workspaceId, instagramAccountId: parsed.data.instagramAccountId, isActive: true },
  });
  if (!config) {
    return NextResponse.json({ success: true, data: { matched: null, reply: null } });
  }

  // AI first
  if (config.aiEnabled && isAIEnabled()) {
    try {
      const gen = await generateReply({
        message: parsed.data.messageText,
        knowledge: config.knowledge ?? "",
        username: null,
      });
      return NextResponse.json({
        success: true,
        data: { matched: { type: "AI", id: config.id }, reply: gen.text, ai: true, model: gen.model },
      });
    } catch (e) {
      // fall through to fallback
      const aiError = e instanceof Error ? e.message : "AI failed";
      const fallback = await fallbackPreview(config, parsed.data.messageText);
      if (fallback) {
        return NextResponse.json({
          success: true,
          data: { ...fallback, aiError },
        });
      }
      return NextResponse.json({
        success: true,
        data: { matched: null, reply: null, aiError },
      });
    }
  }

  const fallback = await fallbackPreview(config, parsed.data.messageText);
  if (fallback) return NextResponse.json({ success: true, data: fallback });
  return NextResponse.json({ success: true, data: { matched: null, reply: null } });
}

async function fallbackPreview(
  config: { id: string; fallbackKeywords: string[]; fallbackMessage: string; wholeWordMatch: boolean; matchAnyWord: boolean },
  messageText: string
) {
  const { matchKeywords } = await import("@/lib/utils/keyword-matcher");
  const { renderMessageWithoutLink } = await import("@/lib/tracking/message");
  const isCatchAll = config.fallbackKeywords.length === 0 && !config.matchAnyWord;
  let shouldSend = false;
  if (config.matchAnyWord || isCatchAll) shouldSend = true;
  else {
    const hit = matchKeywords(messageText, config.fallbackKeywords, config.wholeWordMatch).matched;
    shouldSend = hit;
  }
  if (!shouldSend) return null;
  if (!config.fallbackMessage.trim()) return null;
  return {
    matched: { type: "FALLBACK", id: config.id },
    reply: renderMessageWithoutLink({ message: config.fallbackMessage, commenterName: "there" }),
    ai: false,
  };
}
