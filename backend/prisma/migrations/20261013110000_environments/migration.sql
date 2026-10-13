CREATE TABLE "Environment" (
  "id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL, "stage" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
  "ownerId" INTEGER NOT NULL REFERENCES "User"("id"), "encryptedVariables" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Environment_ownerId_name_key" ON "Environment"("ownerId", "name");
ALTER TABLE "Integration" ADD COLUMN "environmentId" INTEGER REFERENCES "Environment"("id");
CREATE INDEX "Integration_environmentId_idx" ON "Integration"("environmentId");
