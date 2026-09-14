import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageAutomations,
  getCurrentWorkspaceContext,
  getCurrentWorkspaceId,
} from "@/lib/workspace-access";
import { classifyIntent, generateReply } from "@/lib/ai/client";
import { isAIEnabled } from "@/lib/env";

// This list is read-your-writes — never cache it at the route or CDN layer.
const triggerEnum = z.enum(["KEYWORD", "AI_INTENT", "ALWAYS"]);

const baseFields = {
  name: z.string().min(1).max(100),
  instagramAccountId: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(9999).optional().default(0),
  triggerType: triggerEnum.optional().default("KEYWORD"),
  keywords: z.array(z.string().min(1).max(50)).max(10).optional().default([]),
  wholeWordMatch: z.boolean().optional().default(true),
  matchAnyWord: z.boolean().optional().default(false),
  aiEnabled: z.boolean().optional().default(false),
  aiIntent: z.string().min(1).max(60).optional().nullable(),
  knowledge: z.string().max(4000).optional().nullable(),
  aiModel: z.string().max(60).optional().nullable(),
  message: z.string().max(1000).optional().default(""),
};

const createSchema = z
  .object(baseFields)
  .refine((d) => d.triggerType !== "KEYWORD" || d.matchAnyWord || d.keywords.length >= 1, {
    message: "Add at least one keyword, or match any word",
    path: ["keywords"],
  })
  .refine((d) => d.triggerType !== "AI_INTENT" || Boolean(d.aiIntent?.trim()), {
    message: "AI intent needs a name (e.g. pricing)",
    path: ["aiIntent"],
  })
  .refine(
    (d) =>
      !d.aiEnabled ||
      Boolean(d.knowledge?.trim()) ||
      d.triggerType !== "AI_INTENT" ||
      true,
    { message: "Add knowledge so the AI stays grounded", path: ["knowledge"] }
  )
  .refine(
    (d) =>
      d.aiEnabled ||
      d.triggerType === "ALWAYS" ||
      Boolean(d.message?.trim()) ||
      d.matchAnyWord,
    { message: "Add the reply message", path: ["message"] }
  );

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  triggerType: triggerEnum.optional(),
  keywords: z.array(z.string().min(1).max(50)).max(10).optional(),
  wholeWordMatch: z.boolean().optional(),
  matchAnyWord: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  aiIntent: z.string().min(1).max(60).optional().nullable(),
  knowledge: z.string().max(4000).optional().nullable(),
  aiModel: z.string().max(60).optional().nullable(),
  message: z.string().max(1000).optional(),
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
      include: {
        _count: { select: { dmLogs: true } },
      },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const sent = await prisma.dmLog.count({
      where: { inboxAutomationId: id, status: "SENT" },
    });
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
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
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
  // Simplest-one: only one ALWAYS catch-all per account.
  if (parsed.data.triggerType === "ALWAYS") {
    const existing = await prisma.inboxAutomation.findFirst({
      where: {
        workspaceId: context.workspaceId,
        instagramAccountId: parsed.data.instagramAccountId,
        triggerType: "ALWAYS",
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This account already has a catch-all rule — edit it instead" },
        { status: 409 }
      );
    }
  }

  const created = await prisma.inboxAutomation.create({
    data: {
      workspaceId: context.workspaceId,
      instagramAccountId: parsed.data.instagramAccountId,
      name: parsed.data.name.trim(),
      isActive: parsed.data.isActive,
      priority: parsed.data.priority,
      triggerType: parsed.data.triggerType,
      keywords: parsed.data.matchAnyWord ? [] : parsed.data.keywords,
      wholeWordMatch: parsed.data.wholeWordMatch,
      matchAnyWord: parsed.data.matchAnyWord,
      aiEnabled: parsed.data.aiEnabled,
      aiIntent: parsed.data.aiIntent?.trim() || null,
      knowledge: parsed.data.knowledge?.trim() || null,
      aiModel: parsed.data.aiModel?.trim() || null,
      message: parsed.data.message ?? "",
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
  if (parsed.data.triggerType === "ALWAYS" && existing.triggerType !== "ALWAYS") {
    const clash = await prisma.inboxAutomation.findFirst({
      where: {
        workspaceId: context.workspaceId,
        instagramAccountId: existing.instagramAccountId,
        triggerType: "ALWAYS",
        id: { not: id },
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { success: false, error: "This account already has a catch-all rule" },
        { status: 409 }
      );
    }
  }
  const data = { ...parsed.data } as Record<string, unknown>;
  if (parsed.data.matchAnyWord === true) data.keywords = [];
  if (parsed.data.name) data.name = (parsed.data.name as string).trim();
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
// PUT /api/inbox-automations { instagramAccountId?, messageText, ruleId? }
// Returns which rule would match + a simulated reply (AI called for real when
// the matched rule has aiEnabled; otherwise renders the static template).
const previewSchema = z.object({
  instagramAccountId: z.string().min(1).optional(),
  messageText: z.string().min(1).max(1000),
  ruleId: z.string().min(1).optional(),
});

export async function PUT(request: NextRequest) {
  // PUT is the preview RPC (POST/PATCH/DELETE stay RESTful for CRUD).
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  // Preview is available even without AI configured (static tiers still work).
  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { matchKeywords } = await import("@/lib/utils/keyword-matcher");
  const rules = await prisma.inboxAutomation.findMany({
    where: {
      workspaceId,
      isActive: true,
      ...(parsed.data.ruleId
        ? { id: parsed.data.ruleId }
        : parsed.data.instagramAccountId
          ? { instagramAccountId: parsed.data.instagramAccountId }
          : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  if (rules.length === 0) {
    return NextResponse.json({ success: true, data: { matched: null } });
  }

  const aiIntents = rules
    .filter((r) => r.triggerType === "AI_INTENT" && r.aiIntent)
    .map((r) => r.aiIntent as string);

  let classified: string | null = null;
  if (aiIntents.length > 0 && isAIEnabled()) {
    try {
      const c = await classifyIntent(parsed.data.messageText, aiIntents);
      classified = c.intent === "none" ? null : c.intent;
    } catch {
      classified = null;
    }
  }

  for (const rule of rules) {
    let matched = false;
    if (rule.triggerType === "ALWAYS") matched = true;
    else if (rule.triggerType === "AI_INTENT") {
      matched = Boolean(
        rule.aiIntent && classified && rule.aiIntent.toLowerCase() === classified.toLowerCase()
      );
    } else {
      matched = rule.matchAnyWord
        ? true
        : matchKeywords(parsed.data.messageText, rule.keywords, rule.wholeWordMatch).matched;
    }
    if (!matched) continue;

    if (rule.aiEnabled && isAIEnabled()) {
      try {
        const gen = await generateReply({
          message: parsed.data.messageText,
          knowledge: rule.knowledge ?? "",
          username: null,
        });
        return NextResponse.json({
          success: true,
          data: {
            matched: {
              id: rule.id,
              name: rule.name,
              triggerType: rule.triggerType,
              aiIntent: rule.aiIntent,
            },
            reply: gen.text,
            ai: true,
            model: gen.model,
            classified,
          },
        });
      } catch (e) {
        return NextResponse.json({
          success: true,
          data: {
            matched: { id: rule.id, name: rule.name, triggerType: rule.triggerType },
            reply: rule.message || "(AI failed — static fallback empty)",
            ai: false,
            aiError: e instanceof Error ? e.message : "AI failed",
            classified,
          },
        });
      }
    }

    const { renderMessageWithoutLink } = await import("@/lib/tracking/message");
    return NextResponse.json({
      success: true,
      data: {
        matched: { id: rule.id, name: rule.name, triggerType: rule.triggerType },
        reply: renderMessageWithoutLink({ message: rule.message, commenterName: "there" }),
        ai: false,
        classified,
      },
    });
  }

  return NextResponse.json({ success: true, data: { matched: null, classified } });
}
