CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "IntegrationExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR');

CREATE TABLE "Integration" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "baseUrl" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "headers" JSONB,
  "queryParams" JSONB,
  "body" JSONB,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationExecution" (
  "id" SERIAL NOT NULL,
  "integrationId" INTEGER NOT NULL,
  "status" "IntegrationExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "httpStatus" INTEGER,
  "requestUrl" TEXT,
  "requestMethod" TEXT,
  "requestHeaders" JSONB,
  "requestQueryParams" JSONB,
  "requestBody" JSONB,
  "responseBody" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationExecution_integrationId_idx" ON "IntegrationExecution"("integrationId");
CREATE INDEX "IntegrationExecution_createdAt_idx" ON "IntegrationExecution"("createdAt");
CREATE INDEX "IntegrationExecution_status_idx" ON "IntegrationExecution"("status");

ALTER TABLE "IntegrationExecution"
ADD CONSTRAINT "IntegrationExecution_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
