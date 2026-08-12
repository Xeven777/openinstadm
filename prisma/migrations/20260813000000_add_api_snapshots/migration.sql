CREATE TABLE "ApiSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instagramAccountId" TEXT,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiSnapshot_key_key" ON "ApiSnapshot"("key");
CREATE INDEX "ApiSnapshot_workspaceId_source_expiresAt_idx" ON "ApiSnapshot"("workspaceId", "source", "expiresAt");
CREATE INDEX "ApiSnapshot_instagramAccountId_source_expiresAt_idx" ON "ApiSnapshot"("instagramAccountId", "source", "expiresAt");
CREATE INDEX "ApiSnapshot_expiresAt_idx" ON "ApiSnapshot"("expiresAt");

ALTER TABLE "ApiSnapshot" ADD CONSTRAINT "ApiSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiSnapshot" ADD CONSTRAINT "ApiSnapshot_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
