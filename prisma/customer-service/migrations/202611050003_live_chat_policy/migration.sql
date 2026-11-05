ALTER TABLE "ChatTrainingSession" ADD COLUMN "policySnapshot" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ChatConversation" ADD COLUMN "policySnapshot" JSONB NOT NULL DEFAULT '{}';
