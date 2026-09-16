-- The Instagram 24-hour messaging window used to be a Redis key per
-- (account, user) with a Lua compare-and-set. It is now a Postgres row, so the
-- app no longer needs Redis at all.
--
-- `respondedAt` stores Meta's event time and only ever moves forward (the
-- upsert in lib/meta/messaging-window.ts has a WHERE guard for that), so a
-- delayed or duplicate webhook cannot reopen an expired window.
CREATE TABLE "MessagingInteraction" (
    "instagramAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingInteraction_pkey" PRIMARY KEY ("instagramAccountId","userId")
);

CREATE INDEX "MessagingInteraction_respondedAt_idx" ON "MessagingInteraction"("respondedAt");
