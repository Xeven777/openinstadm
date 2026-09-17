-- Retain existing delegated campaign access while separating Inbox Automations
-- into its own explicit, opt-in permission.
ALTER TYPE "WorkspacePermission" RENAME VALUE 'MANAGE_AUTOMATIONS' TO 'MANAGE_CAMPAIGNS';
ALTER TYPE "WorkspacePermission" ADD VALUE 'MANAGE_INBOX_AUTOMATIONS' AFTER 'MANAGE_CAMPAIGNS';
