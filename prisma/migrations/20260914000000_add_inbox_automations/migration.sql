-- CreateEnum
CREATE TYPE "InboxTrigger" AS ENUM ('KEYWORD', 'AI_INTENT', 'ALWAYS');

-- AlterEnum (add AI source for AI-tier observability)
ALTER TYPE "OperationalEventSource" ADD VALUE IF NOT EXISTS 'AI';

-- CreateTable
CREATE TABLE "InboxAutomation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "triggerType" "InboxTrigger" NOT NULL DEFAULT 'KEYWORD',
    "keywords" TEXT[] NOT NULL DEFAULT '{}',
    "wholeWordMatch" BOOLEAN NOT NULL DEFAULT true,
    "matchAnyWord" BOOLEAN NOT NULL DEFAULT false,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiIntent" TEXT,
    "knowledge" TEXT,
    "aiModel" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxAutomation_pkey" PRIMARY KEY ("id")
);

-- AlterTable (AI audit on DmLog)
ALTER TABLE "DmLog" ADD COLUMN IF NOT EXISTS "inboxAutomationId" TEXT,
ADD COLUMN IF NOT EXISTS "aiUsed" BOOLEAN,
ADD COLUMN IF NOT EXISTS "aiModel" TEXT,
ADD COLUMN IF NOT EXISTS "aiIntent" TEXT,
ADD COLUMN IF NOT EXISTS "aiLatencyMs" INTEGER;

-- Backfill: one ALWAYS catch-all per account that had the legacy fallback on.
-- Simplest-one semantics: single catch-all at priority 999, inactive AI.
INSERT INTO "InboxAutomation"
  ("id", "workspaceId", "instagramAccountId", "name", "isActive", "priority",
   "triggerType", "keywords", "wholeWordMatch", "matchAnyWord",
   "aiEnabled", "aiIntent", "knowledge", "aiModel", "message",
   "createdAt", "updatedAt")
SELECT
  'inbox_' || "id",
  "workspaceId",
  "id",
  'Catch-all reply',
  true,
  999,
  'ALWAYS',
  '{}',
  true,
  false,
  false,
  NULL,
  NULL,
  NULL,
  COALESCE("fallbackReplyMessage", ''),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "InstagramAccount"
WHERE "fallbackReplyEnabled" = true
  AND "fallbackReplyMessage" IS NOT NULL
  AND TRIM("fallbackReplyMessage") <> ''
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "InboxAutomation" ADD CONSTRAINT "InboxAutomation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxAutomation" ADD CONSTRAINT "InboxAutomation_instagramAccountId_fkey"
  FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmLog" ADD CONSTRAINT "DmLog_inboxAutomationId_fkey"
  FOREIGN KEY ("inboxAutomationId") REFERENCES "InboxAutomation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboxAutomation_workspaceId_idx" ON "InboxAutomation"("workspaceId");
CREATE INDEX IF NOT EXISTS "InboxAutomation_instagramAccountId_priority_idx" ON "InboxAutomation"("instagramAccountId", "priority");
CREATE INDEX IF NOT EXISTS "InboxAutomation_instagramAccountId_isActive_priority_idx" ON "InboxAutomation"("instagramAccountId", "isActive", "priority");
CREATE INDEX IF NOT EXISTS "DmLog_inboxAutomationId_idx" ON "DmLog"("inboxAutomationId");
