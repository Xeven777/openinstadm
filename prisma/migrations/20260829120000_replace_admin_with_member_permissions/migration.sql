-- CreateEnum
CREATE TYPE "WorkspacePermission" AS ENUM (
    'MANAGE_AUTOMATIONS',
    'MANAGE_INSTAGRAM_ACCOUNTS',
    'MANAGE_MEMBERS'
);

-- Add permission storage. New members and invitations receive no delegated
-- permissions unless the owner explicitly grants them.
ALTER TABLE "WorkspaceMember"
    ADD COLUMN "permissions" "WorkspacePermission"[] NOT NULL
    DEFAULT ARRAY[]::"WorkspacePermission"[];

ALTER TABLE "WorkspaceInvitation"
    ADD COLUMN "permissions" "WorkspacePermission"[] NOT NULL
    DEFAULT ARRAY[]::"WorkspacePermission"[];

-- Preserve existing Admin access: convert their role later, but first give
-- them the full set of permissions that Admin previously implied.
UPDATE "WorkspaceMember"
SET "permissions" = ARRAY[
    'MANAGE_AUTOMATIONS',
    'MANAGE_INSTAGRAM_ACCOUNTS',
    'MANAGE_MEMBERS'
]::"WorkspacePermission"[]
WHERE "role" = 'ADMIN';

UPDATE "WorkspaceInvitation"
SET "permissions" = ARRAY[
    'MANAGE_AUTOMATIONS',
    'MANAGE_INSTAGRAM_ACCOUNTS',
    'MANAGE_MEMBERS'
]::"WorkspacePermission"[]
WHERE "role" = 'ADMIN';

-- PostgreSQL does not support removing an enum value directly. Replace the
-- role enum and map ADMIN rows to MEMBER.
CREATE TYPE "WorkspaceRole_new" AS ENUM ('OWNER', 'MEMBER');

ALTER TABLE "WorkspaceMember"
    ALTER COLUMN "role" DROP DEFAULT,
    ALTER COLUMN "role" TYPE "WorkspaceRole_new"
    USING (
        CASE
            WHEN "role"::text = 'ADMIN' THEN 'MEMBER'
            ELSE "role"::text
        END
    )::"WorkspaceRole_new";

ALTER TABLE "WorkspaceInvitation"
    ALTER COLUMN "role" DROP DEFAULT,
    ALTER COLUMN "role" TYPE "WorkspaceRole_new"
    USING (
        CASE
            WHEN "role"::text = 'ADMIN' THEN 'MEMBER'
            ELSE "role"::text
        END
    )::"WorkspaceRole_new";

DROP TYPE "WorkspaceRole";
ALTER TYPE "WorkspaceRole_new" RENAME TO "WorkspaceRole";

-- Match the updated Prisma schema.
ALTER TABLE "WorkspaceMember"
    ALTER COLUMN "role" SET DEFAULT 'MEMBER';

ALTER TABLE "WorkspaceInvitation"
    ALTER COLUMN "role" SET DEFAULT 'MEMBER';