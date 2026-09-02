-- AlterTable
ALTER TABLE "DmLog" ALTER COLUMN "automationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InstagramAccount" ADD COLUMN     "fallbackReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fallbackReplyMessage" TEXT;

-- CreateIndex
CREATE INDEX "DmLog_instagramAccountId_commentId_idx" ON "DmLog"("instagramAccountId", "commentId");
