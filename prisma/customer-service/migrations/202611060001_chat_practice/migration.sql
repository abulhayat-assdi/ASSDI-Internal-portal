ALTER TABLE "ChatConversation" ADD COLUMN "practiceKey" TEXT, ADD COLUMN "practiceStep" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "practiceStartedAt" TIMESTAMP(3), ADD COLUMN "practiceScript" JSONB;
CREATE UNIQUE INDEX "ChatConversation_workspaceId_practiceKey_key" ON "ChatConversation"("workspaceId","practiceKey");
