-- Simplify InboxAutomation to one master row per account (AI + fallback only)
-- Removes multi-rule priority maze that caused keyword-shadow bugs.

-- Add new columns (idempotent)
ALTER TABLE "InboxAutomation" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT;
ALTER TABLE "InboxAutomation" ADD COLUMN IF NOT EXISTS "fallbackKeywords" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "InboxAutomation" ADD COLUMN IF NOT EXISTS "fallbackMessage" TEXT NOT NULL DEFAULT '';

-- Backfill new fields from old columns where they exist
DO $$
BEGIN
  -- Only run backfill if old columns still exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='InboxAutomation' AND column_name='keywords') THEN
    UPDATE "InboxAutomation" SET "fallbackKeywords" = "keywords" WHERE "fallbackKeywords" = '{}' AND "keywords" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='InboxAutomation' AND column_name='message') THEN
    UPDATE "InboxAutomation" SET "fallbackMessage" = "message" WHERE "fallbackMessage" = '' AND "message" IS NOT NULL AND "message" <> '';
  END IF;
END $$;

-- Collapse multiple rules per account into one master row.
-- Strategy: per instagramAccountId, keep the most useful row:
--  1) ALWAYS catch-all preferred, else 2) earliest created.
-- Merge: take aiEnabled/knowledge from any AI-enabled row if keeper lacks it,
-- and fallback fields from the keeper.
DO $$
DECLARE
  acct TEXT;
  keeper TEXT;
  merged_knowledge TEXT;
  merged_aiEnabled BOOLEAN;
  merged_aiProvider TEXT;
  merged_aiModel TEXT;
BEGIN
  FOR acct IN SELECT DISTINCT "instagramAccountId" FROM "InboxAutomation" LOOP
    -- pick keeper: ALWAYS first, else earliest
    SELECT "id" INTO keeper FROM "InboxAutomation"
    WHERE "instagramAccountId" = acct
    ORDER BY CASE WHEN "triggerType" = 'ALWAYS' THEN 0 ELSE 1 END, "createdAt" ASC
    LIMIT 1;

    -- merge AI config from other rows if keeper is not AI-enabled
    IF EXISTS (SELECT 1 FROM "InboxAutomation" WHERE "instagramAccountId"=acct AND "aiEnabled"=true) THEN
      SELECT "knowledge", "aiEnabled", "aiProvider", "aiModel"
        INTO merged_knowledge, merged_aiEnabled, merged_aiProvider, merged_aiModel
      FROM "InboxAutomation" WHERE "instagramAccountId"=acct AND "aiEnabled"=true
      ORDER BY "createdAt" DESC LIMIT 1;

      UPDATE "InboxAutomation" SET
        "aiEnabled" = COALESCE(merged_aiEnabled, "aiEnabled"),
        "knowledge" = COALESCE(merged_knowledge, "knowledge"),
        "aiProvider" = COALESCE(merged_aiProvider, "aiProvider"),
        "aiModel" = COALESCE(merged_aiModel, "aiModel")
      WHERE "id" = keeper;
    END IF;

    -- delete duplicates
    DELETE FROM "InboxAutomation" WHERE "instagramAccountId"=acct AND "id" <> keeper;
  END LOOP;
END $$;

-- Drop old indexes that reference removed columns
DROP INDEX IF EXISTS "InboxAutomation_instagramAccountId_priority_idx";
DROP INDEX IF EXISTS "InboxAutomation_instagramAccountId_isActive_priority_idx";

-- Make instagramAccountId unique (one master per account)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InboxAutomation_instagramAccountId_key'
  ) THEN
    ALTER TABLE "InboxAutomation" ADD CONSTRAINT "InboxAutomation_instagramAccountId_key" UNIQUE ("instagramAccountId");
  END IF;
END $$;

-- Drop legacy columns (if they exist)
ALTER TABLE "InboxAutomation" DROP COLUMN IF EXISTS "name";
ALTER TABLE "InboxAutomation" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "InboxAutomation" DROP COLUMN IF EXISTS "triggerType";
ALTER TABLE "InboxAutomation" DROP COLUMN IF EXISTS "keywords";
ALTER TABLE "InboxAutomation" DROP COLUMN IF EXISTS "aiIntent";
ALTER TABLE "InboxAutomation" DROP COLUMN IF EXISTS "message";

-- Create index for new shape (workspace lookup)
CREATE INDEX IF NOT EXISTS "InboxAutomation_workspaceId_idx" ON "InboxAutomation"("workspaceId");

-- Enum InboxTrigger is now unused but kept for backward compat; no drop.
