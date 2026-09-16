CREATE TABLE "AiProviderCredential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderCredential_workspaceId_provider_key" ON "AiProviderCredential"("workspaceId", "provider");

ALTER TABLE "AiProviderCredential" ADD CONSTRAINT "AiProviderCredential_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
