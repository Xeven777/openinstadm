-- Move the last Redis state into Postgres so the app needs no Redis.
--
-- WindowCounter replaces the `rate:dm:<account>` and `ai:budget:<workspace>` keys.
-- Both are claimed with a single atomic upsert, which is what the old Lua
-- script bought us: two concurrent jobs can never both take the last slot.
--
-- RunnerHeartbeat replaces the `health:worker:dm` key.

-- CreateTable
CREATE TABLE "WindowCounter" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WindowCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RunnerHeartbeat" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "runId" TEXT,
    "hostname" TEXT,
    "pid" INTEGER,
    "startedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunnerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunnerHeartbeat_checkedAt_idx" ON "RunnerHeartbeat"("checkedAt");

-- CreateIndex (diagnostics now reads recent worker alerts from this table)
CREATE INDEX "OperationalEvent_source_level_createdAt_idx" ON "OperationalEvent"("source", "level", "createdAt");
