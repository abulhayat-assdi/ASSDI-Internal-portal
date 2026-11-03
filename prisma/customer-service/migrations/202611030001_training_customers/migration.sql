ALTER TABLE "Customer"
  ADD COLUMN "trainingKey" TEXT,
  ADD COLUMN "registeredNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "registeredNormalized" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "trainingProfile" JSONB;

CREATE UNIQUE INDEX "Customer_workspaceId_trainingKey_key" ON "Customer"("workspaceId", "trainingKey");
CREATE INDEX "Customer_workspaceId_registeredNormalized_idx" ON "Customer"("workspaceId", "registeredNormalized");
