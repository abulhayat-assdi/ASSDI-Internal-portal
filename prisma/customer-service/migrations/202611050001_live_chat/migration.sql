-- CreateTable
CREATE TABLE "ChatSettings" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChatSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatCategory" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChatCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTrainingSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PRACTICE',
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "scenario" TEXT NOT NULL DEFAULT '',
    "participants" TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "hints" BOOLEAN NOT NULL DEFAULT true,
    "demonstrationId" TEXT,
    "rubric" JSONB NOT NULL,
    "passMark" INTEGER NOT NULL DEFAULT 70,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPublicLink" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sessionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAgentState" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roll" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAgentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatCustomerSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatCustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionId" TEXT,
    "customerSessionId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "agentId" TEXT,
    "customerId" TEXT,
    "complaintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "firstReplyAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastCustomerAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAgentAt" TIMESTAMP(3),
    "unansweredAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warned" BOOLEAN NOT NULL DEFAULT false,
    "serviceSeconds" INTEGER NOT NULL DEFAULT 60,
    "resolution" TEXT NOT NULL DEFAULT '',
    "closingNote" TEXT NOT NULL DEFAULT '',
    "transferTo" TEXT,
    "transferAt" TIMESTAMP(3),
    "customerTypingAt" TIMESTAMP(3),
    "agentTypingAt" TIMESTAMP(3),
    "customerReadAt" TIMESTAMP(3),
    "agentReadAt" TIMESTAMP(3),
    "feedback" INTEGER,
    "feedbackComment" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MESSAGE',
    "text" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "firstReplyAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "wrapSeconds" INTEGER NOT NULL DEFAULT 0,
    "handleSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ChatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatEvent" (
    "id" BIGSERIAL NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatQaEvaluation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "rubric" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "passMark" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "privateNote" TEXT NOT NULL DEFAULT '',
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatQaEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReference" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChatReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRateBucket" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRateBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSettings_workspaceId_key" ON "ChatSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSettings_workspaceId_id_key" ON "ChatSettings"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCategory_workspaceId_id_key" ON "ChatCategory"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCategory_workspaceId_name_key" ON "ChatCategory"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ChatTrainingSession_workspaceId_state_idx" ON "ChatTrainingSession"("workspaceId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTrainingSession_workspaceId_id_key" ON "ChatTrainingSession"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPublicLink_tokenHash_key" ON "ChatPublicLink"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPublicLink_workspaceId_id_key" ON "ChatPublicLink"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ChatAgentState_workspaceId_status_lastAssignedAt_idx" ON "ChatAgentState"("workspaceId", "status", "lastAssignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAgentState_workspaceId_id_key" ON "ChatAgentState"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAgentState_workspaceId_userId_key" ON "ChatAgentState"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCustomerSession_tokenHash_key" ON "ChatCustomerSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCustomerSession_workspaceId_id_key" ON "ChatCustomerSession"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ChatConversation_workspaceId_status_queueAt_idx" ON "ChatConversation"("workspaceId", "status", "queueAt");

-- CreateIndex
CREATE INDEX "ChatConversation_workspaceId_agentId_status_idx" ON "ChatConversation"("workspaceId", "agentId", "status");

-- CreateIndex
CREATE INDEX "ChatConversation_workspaceId_createdAt_idx" ON "ChatConversation"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatConversation_workspaceId_customerSessionId_idx" ON "ChatConversation"("workspaceId", "customerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_workspaceId_id_key" ON "ChatConversation"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ChatMessage_workspaceId_conversationId_createdAt_id_idx" ON "ChatMessage"("workspaceId", "conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_workspaceId_id_key" ON "ChatMessage"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_workspaceId_conversationId_senderId_requestId_key" ON "ChatMessage"("workspaceId", "conversationId", "senderId", "requestId");

-- CreateIndex
CREATE INDEX "ChatAssignment_workspaceId_conversationId_idx" ON "ChatAssignment"("workspaceId", "conversationId");

-- CreateIndex
CREATE INDEX "ChatAssignment_workspaceId_agentId_endedAt_idx" ON "ChatAssignment"("workspaceId", "agentId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAssignment_workspaceId_id_key" ON "ChatAssignment"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ChatEvent_workspaceId_id_idx" ON "ChatEvent"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ChatEvent_workspaceId_conversationId_id_idx" ON "ChatEvent"("workspaceId", "conversationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatQaEvaluation_workspaceId_id_key" ON "ChatQaEvaluation"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatQaEvaluation_workspaceId_conversationId_agentId_key" ON "ChatQaEvaluation"("workspaceId", "conversationId", "agentId");

-- CreateIndex
CREATE INDEX "ChatReference_workspaceId_kind_idx" ON "ChatReference"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReference_workspaceId_id_key" ON "ChatReference"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ChatRateBucket_workspaceId_expiresAt_idx" ON "ChatRateBucket"("workspaceId", "expiresAt");

ALTER TABLE "ChatSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatSettings" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatSettings" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatSettings" ADD CONSTRAINT "ChatSettings_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatCategory" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatCategory" ADD CONSTRAINT "ChatCategory_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatTrainingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatTrainingSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatTrainingSession" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatTrainingSession" ADD CONSTRAINT "ChatTrainingSession_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatPublicLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatPublicLink" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatPublicLink" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatPublicLink" ADD CONSTRAINT "ChatPublicLink_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatAgentState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatAgentState" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatAgentState" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatAgentState" ADD CONSTRAINT "ChatAgentState_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatCustomerSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatCustomerSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatCustomerSession" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatCustomerSession" ADD CONSTRAINT "ChatCustomerSession_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatConversation" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatConversation" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatMessage" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatAssignment" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatAssignment" ADD CONSTRAINT "ChatAssignment_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatEvent" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatQaEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatQaEvaluation" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatQaEvaluation" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatQaEvaluation" ADD CONSTRAINT "ChatQaEvaluation_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatReference" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatReference" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatReference" ADD CONSTRAINT "ChatReference_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");

ALTER TABLE "ChatRateBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatRateBucket" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "ChatRateBucket" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "ChatRateBucket" ADD CONSTRAINT "ChatRateBucket_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "ChatPublicLink" ADD CONSTRAINT "ChatPublicLink_sessionId_fk" FOREIGN KEY ("workspaceId","sessionId") REFERENCES "ChatTrainingSession"("workspaceId","id");
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_sessionId_fk" FOREIGN KEY ("workspaceId","sessionId") REFERENCES "ChatTrainingSession"("workspaceId","id");
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_categoryId_fk" FOREIGN KEY ("workspaceId","categoryId") REFERENCES "ChatCategory"("workspaceId","id");
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_customerSessionId_fk" FOREIGN KEY ("workspaceId","customerSessionId") REFERENCES "ChatCustomerSession"("workspaceId","id");
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_customerId_fk" FOREIGN KEY ("workspaceId","customerId") REFERENCES "Customer"("workspaceId","id");
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_complaintId_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fk" FOREIGN KEY ("workspaceId","conversationId") REFERENCES "ChatConversation"("workspaceId","id");
ALTER TABLE "ChatAssignment" ADD CONSTRAINT "ChatAssignment_conversationId_fk" FOREIGN KEY ("workspaceId","conversationId") REFERENCES "ChatConversation"("workspaceId","id");
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_conversationId_fk" FOREIGN KEY ("workspaceId","conversationId") REFERENCES "ChatConversation"("workspaceId","id");
ALTER TABLE "ChatQaEvaluation" ADD CONSTRAINT "ChatQaEvaluation_conversationId_fk" FOREIGN KEY ("workspaceId","conversationId") REFERENCES "ChatConversation"("workspaceId","id");
ALTER TABLE "ChatConversation" ADD CONSTRAINT chat_status_check CHECK (status IN ('QUEUED','ASSIGNED','ACTIVE','RESOLVED','CLOSED','ABANDONED','DROPPED'));
ALTER TABLE "ChatAgentState" ADD CONSTRAINT chat_availability_check CHECK (status IN ('AVAILABLE','BUSY','AWAY','OFFLINE'));
ALTER TABLE "ChatMessage" ADD CONSTRAINT chat_message_kind_check CHECK (kind IN ('MESSAGE','NOTE','COACH'));
ALTER TABLE "ChatConversation" ADD CONSTRAINT chat_rating_check CHECK (feedback IS NULL OR feedback BETWEEN 1 AND 5);
CREATE UNIQUE INDEX chat_one_open_assignment ON "ChatAssignment" ("workspaceId","conversationId") WHERE "endedAt" IS NULL;
CREATE TRIGGER chat_events_immutable BEFORE UPDATE OR DELETE ON "ChatEvent" FOR EACH ROW EXECUTE FUNCTION crm_append_only();
CREATE TRIGGER chat_messages_immutable BEFORE UPDATE OR DELETE ON "ChatMessage" FOR EACH ROW EXECUTE FUNCTION crm_append_only();
