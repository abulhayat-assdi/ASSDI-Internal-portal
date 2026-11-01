-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AGENT',
    "teamId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "dummy" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "complaintType" TEXT NOT NULL DEFAULT '',
    "issueType" TEXT NOT NULL DEFAULT '',
    "primaryTag" TEXT NOT NULL DEFAULT '',
    "overallMinutes" INTEGER NOT NULL,
    "l2Minutes" INTEGER,
    "l3Minutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "customerId" TEXT,
    "creatorId" TEXT NOT NULL,
    "ownerId" TEXT,
    "teamId" TEXT,
    "callingNumber" TEXT NOT NULL,
    "callingNormalized" TEXT NOT NULL,
    "registeredNumber" TEXT NOT NULL DEFAULT '',
    "registeredNormalized" TEXT NOT NULL DEFAULT '',
    "identifier" TEXT NOT NULL DEFAULT '',
    "callerType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "complaintType" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "primaryTag" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "transactionDate" TIMESTAMP(3),
    "transactionAmount" DECIMAL(18,2),
    "transactionId" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "fieldSnapshot" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "queue" TEXT NOT NULL DEFAULT 'AGENT',
    "returnState" TEXT NOT NULL DEFAULT 'NORMAL',
    "resolutionReason" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "resolverId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "firstL2At" TIMESTAMP(3),
    "l2CompletedAt" TIMESTAMP(3),
    "firstL3At" TIMESTAMP(3),
    "l2DueAt" TIMESTAMP(3),
    "l3DueAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3) NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "History" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaintId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "requestId" TEXT NOT NULL,

    CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaintId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaintId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaintId" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaintId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "targetMinutes" INTEGER,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_courseId_batchId_key" ON "Workspace"("courseId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_courseId_id_key" ON "Workspace"("courseId", "id");

-- CreateIndex
CREATE INDEX "Member_courseId_workspaceId_idx" ON "Member"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_workspaceId_id_key" ON "Member"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Member_workspaceId_userId_key" ON "Member"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "StaffAssignment_courseId_workspaceId_idx" ON "StaffAssignment"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAssignment_workspaceId_id_key" ON "StaffAssignment"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAssignment_workspaceId_userId_key" ON "StaffAssignment"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Team_courseId_workspaceId_idx" ON "Team"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_workspaceId_id_key" ON "Team"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Team_workspaceId_name_key" ON "Team"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Customer_courseId_workspaceId_idx" ON "Customer"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_workspaceId_id_key" ON "Customer"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_workspaceId_number_key" ON "Customer"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "Option_courseId_workspaceId_idx" ON "Option"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Option_workspaceId_id_key" ON "Option"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Option_workspaceId_kind_label_key" ON "Option"("workspaceId", "kind", "label");

-- CreateIndex
CREATE INDEX "Policy_courseId_workspaceId_idx" ON "Policy"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_workspaceId_id_key" ON "Policy"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_workspaceId_key_key" ON "Policy"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_code_key" ON "Complaint"("code");

-- CreateIndex
CREATE INDEX "Complaint_courseId_workspaceId_idx" ON "Complaint"("courseId", "workspaceId");

-- CreateIndex
CREATE INDEX "Complaint_workspaceId_status_queue_idx" ON "Complaint"("workspaceId", "status", "queue");

-- CreateIndex
CREATE INDEX "Complaint_workspaceId_ownerId_idx" ON "Complaint"("workspaceId", "ownerId");

-- CreateIndex
CREATE INDEX "Complaint_workspaceId_callingNormalized_createdAt_idx" ON "Complaint"("workspaceId", "callingNormalized", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_workspaceId_registeredNormalized_idx" ON "Complaint"("workspaceId", "registeredNormalized");

-- CreateIndex
CREATE INDEX "Complaint_workspaceId_resolvedAt_idx" ON "Complaint"("workspaceId", "resolvedAt");

-- CreateIndex
CREATE INDEX "Complaint_workspaceId_dueAt_idx" ON "Complaint"("workspaceId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_workspaceId_id_key" ON "Complaint"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_workspaceId_creatorId_requestId_key" ON "Complaint"("workspaceId", "creatorId", "requestId");

-- CreateIndex
CREATE INDEX "History_courseId_workspaceId_idx" ON "History"("courseId", "workspaceId");

-- CreateIndex
CREATE INDEX "History_workspaceId_complaintId_createdAt_idx" ON "History"("workspaceId", "complaintId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "History_workspaceId_id_key" ON "History"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "History_workspaceId_complaintId_requestId_key" ON "History"("workspaceId", "complaintId", "requestId");

-- CreateIndex
CREATE INDEX "Interaction_courseId_workspaceId_idx" ON "Interaction"("courseId", "workspaceId");

-- CreateIndex
CREATE INDEX "Interaction_workspaceId_createdAt_idx" ON "Interaction"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Interaction_workspaceId_id_key" ON "Interaction"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "Note_courseId_workspaceId_idx" ON "Note"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_workspaceId_id_key" ON "Note"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "FollowUp_courseId_workspaceId_idx" ON "FollowUp"("courseId", "workspaceId");

-- CreateIndex
CREATE INDEX "FollowUp_workspaceId_responsibleId_dueAt_idx" ON "FollowUp"("workspaceId", "responsibleId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_workspaceId_id_key" ON "FollowUp"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "Escalation_courseId_workspaceId_idx" ON "Escalation"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Escalation_workspaceId_id_key" ON "Escalation"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Escalation_workspaceId_complaintId_stage_key" ON "Escalation"("workspaceId", "complaintId", "stage");

-- CreateIndex
CREATE INDEX "Audit_courseId_workspaceId_idx" ON "Audit"("courseId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_workspaceId_id_key" ON "Audit"("workspaceId", "id");

ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Workspace" USING ("courseId" = current_setting('crm.course',true) AND ("id" = current_setting('crm.workspace',true) OR coalesce(current_setting('crm.workspace',true),'') = '')) WITH CHECK ("courseId" = current_setting('crm.course',true) AND ("id" = current_setting('crm.workspace',true) OR coalesce(current_setting('crm.workspace',true),'') = ''));
ALTER TABLE "Member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Member" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Member" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Member" ADD CONSTRAINT "Member_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "StaffAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "StaffAssignment" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Team" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Team" ADD CONSTRAINT "Team_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Customer" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Option" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Option" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Option" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Option" ADD CONSTRAINT "Option_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Policy" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Complaint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Complaint" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Complaint" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "History" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "History" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "History" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "History" ADD CONSTRAINT "History_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Interaction" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Note" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowUp" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "FollowUp" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Escalation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Escalation" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Escalation" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "Audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Audit" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Audit" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id");
ALTER TABLE "History" ADD CONSTRAINT "History_complaint_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id");
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_complaint_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id");
ALTER TABLE "Note" ADD CONSTRAINT "Note_complaint_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id");
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_complaint_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id");
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_complaint_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id");
ALTER TABLE "Member" ADD CONSTRAINT "Member_team_fk" FOREIGN KEY ("workspaceId","teamId") REFERENCES "Team"("workspaceId","id");
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_team_fk" FOREIGN KEY ("workspaceId","teamId") REFERENCES "Team"("workspaceId","id");
ALTER TABLE "Complaint" ADD CONSTRAINT customer_fk FOREIGN KEY ("workspaceId","customerId") REFERENCES "Customer"("workspaceId","id");
ALTER TABLE "Option" ADD CONSTRAINT parent_fk FOREIGN KEY ("workspaceId","parentId") REFERENCES "Option"("workspaceId","id");
ALTER TABLE "Workspace" ADD CONSTRAINT state_check CHECK (state IN ('ACTIVE','READ_ONLY','ARCHIVED'));
ALTER TABLE "Member" ADD CONSTRAINT role_check CHECK (role IN ('AGENT','L2','L3'));
ALTER TABLE "Team" ADD CONSTRAINT tier_check CHECK (tier IN ('L2','L3'));
ALTER TABLE "Complaint" ADD CONSTRAINT workflow_check CHECK (status IN ('PENDING','IN_PROGRESS','RESOLVED','INVALID') AND queue IN ('AGENT','L2','L3') AND ("resolvedAt" IS NULL OR "resolvedAt">="createdAt"));
ALTER TABLE "Policy" ADD CONSTRAINT target_check CHECK ("overallMinutes">0 AND ("l2Minutes" IS NULL OR "l2Minutes">0) AND ("l3Minutes" IS NULL OR "l3Minutes">0));
CREATE FUNCTION crm_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CRM audit records are append-only'; END $$;
CREATE TRIGGER history_immutable BEFORE UPDATE OR DELETE ON "History" FOR EACH ROW EXECUTE FUNCTION crm_append_only();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION crm_append_only();
CREATE FUNCTION crm_code_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code IS DISTINCT FROM OLD.code OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR NEW."creatorId" IS DISTINCT FROM OLD."creatorId" THEN RAISE EXCEPTION 'Immutable complaint identity'; END IF; RETURN NEW; END $$;
CREATE TRIGGER complaint_identity BEFORE UPDATE ON "Complaint" FOR EACH ROW EXECUTE FUNCTION crm_code_immutable();
