ALTER TABLE "Integration" ADD COLUMN "scheduleMinutes" INTEGER,
ADD COLUMN "nextRunAt" TIMESTAMP(3),
ADD COLUMN "failureThreshold" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "slowThresholdMs" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Integration_nextRunAt_idx" ON "Integration"("nextRunAt");
CREATE TABLE "ExecutionJob" (
  "id" SERIAL PRIMARY KEY, "integrationId" INTEGER NOT NULL REFERENCES "Integration"("id"),
  "executionId" INTEGER NOT NULL UNIQUE REFERENCES "IntegrationExecution"("id"),
  "actorId" INTEGER, "state" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "claimedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ExecutionJob_state_runAt_idx" ON "ExecutionJob"("state", "runAt");
CREATE TABLE "IntegrationAlert" (
  "id" SERIAL PRIMARY KEY, "integrationId" INTEGER NOT NULL REFERENCES "Integration"("id"),
  "kind" TEXT NOT NULL, "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "acknowledgedAt" TIMESTAMP(3)
);
CREATE INDEX "IntegrationAlert_integrationId_acknowledgedAt_idx" ON "IntegrationAlert"("integrationId", "acknowledgedAt");
