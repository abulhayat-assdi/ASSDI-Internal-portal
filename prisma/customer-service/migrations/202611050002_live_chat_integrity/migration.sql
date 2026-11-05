ALTER TABLE "ChatConversation" ADD CONSTRAINT chat_agent_fk FOREIGN KEY ("workspaceId","agentId") REFERENCES "ChatAgentState"("workspaceId","userId");
ALTER TABLE "ChatConversation" ADD CONSTRAINT chat_transfer_agent_fk FOREIGN KEY ("workspaceId","transferTo") REFERENCES "ChatAgentState"("workspaceId","userId");
ALTER TABLE "ChatAssignment" ADD CONSTRAINT chat_assignment_agent_fk FOREIGN KEY ("workspaceId","agentId") REFERENCES "ChatAgentState"("workspaceId","userId");
ALTER TABLE "ChatConversation" ADD CONSTRAINT chat_ownership_check CHECK ((status NOT IN ('ASSIGNED','ACTIVE') OR "agentId" IS NOT NULL) AND (status <> 'QUEUED' OR "agentId" IS NULL));
