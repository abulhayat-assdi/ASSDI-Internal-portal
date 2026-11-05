ALTER TABLE "ChatMessage" ADD COLUMN "sequence" BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX "ChatMessage_sequence_key" ON "ChatMessage"("sequence");
CREATE INDEX "ChatMessage_workspace_conversation_sequence_idx" ON "ChatMessage"("workspaceId","conversationId","sequence");
