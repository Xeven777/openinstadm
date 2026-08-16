-- CreateIndex
-- Diagnostics: failed webhook events per workspace, newest first.
CREATE INDEX "WebhookEvent_workspaceId_status_createdAt_idx" ON "WebhookEvent"("workspaceId", "status", "createdAt");

-- CreateIndex
-- Diagnostics: DM failure list is ordered by last activity (updatedAt).
CREATE INDEX "DmLog_workspaceId_status_updatedAt_idx" ON "DmLog"("workspaceId", "status", "updatedAt");

-- CreateIndex
-- Diagnostics: token-refresh failures per workspace, newest first.
CREATE INDEX "OperationalEvent_workspaceId_source_level_createdAt_idx" ON "OperationalEvent"("workspaceId", "source", "level", "createdAt");
