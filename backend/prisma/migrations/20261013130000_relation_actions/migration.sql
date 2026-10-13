ALTER TABLE "Environment" DROP CONSTRAINT "Environment_ownerId_fkey",
ADD CONSTRAINT "Environment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionJob" DROP CONSTRAINT "ExecutionJob_integrationId_fkey",
ADD CONSTRAINT "ExecutionJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionJob" DROP CONSTRAINT "ExecutionJob_executionId_fkey",
ADD CONSTRAINT "ExecutionJob_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "IntegrationExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationAlert" DROP CONSTRAINT "IntegrationAlert_integrationId_fkey",
ADD CONSTRAINT "IntegrationAlert_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_environmentId_fkey",
ADD CONSTRAINT "Integration_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
