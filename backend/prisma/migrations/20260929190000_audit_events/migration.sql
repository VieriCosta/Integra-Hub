CREATE TABLE "AuditEvent" (
  "id" SERIAL NOT NULL,
  "action" TEXT NOT NULL,
  "integrationId" INTEGER NOT NULL,
  "executionId" INTEGER,
  "status" TEXT,
  "httpStatus" INTEGER,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");
CREATE INDEX "AuditEvent_integrationId_idx" ON "AuditEvent"("integrationId");
CREATE INDEX "AuditEvent_executionId_idx" ON "AuditEvent"("executionId");

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "IntegrationExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AuditEvent" ("action", "integrationId")
SELECT 'INTEGRATION_EXISTING', "id" FROM "Integration";

INSERT INTO "AuditEvent" ("action", "integrationId", "executionId", "status", "httpStatus", "durationMs")
SELECT 'EXECUTION_EXISTING', "integrationId", "id", "status"::text, "httpStatus", "durationMs"
FROM "IntegrationExecution";
