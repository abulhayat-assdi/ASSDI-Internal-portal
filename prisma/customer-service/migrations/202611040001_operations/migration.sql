CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "complaintId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_workspace_fk" FOREIGN KEY ("courseId","workspaceId") REFERENCES "Workspace"("courseId","id"),
  CONSTRAINT "Notification_complaint_fk" FOREIGN KEY ("workspaceId","complaintId") REFERENCES "Complaint"("workspaceId","id")
);
CREATE UNIQUE INDEX "Notification_workspaceId_id_key" ON "Notification"("workspaceId","id");
CREATE UNIQUE INDEX "Notification_workspaceId_userId_eventKey_key" ON "Notification"("workspaceId","userId","eventKey");
CREATE INDEX "Notification_courseId_workspaceId_idx" ON "Notification"("courseId","workspaceId");
CREATE INDEX "Notification_workspaceId_userId_createdAt_idx" ON "Notification"("workspaceId","userId","createdAt");
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope ON "Notification" USING ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true)) WITH CHECK ("courseId" = current_setting('crm.course',true) AND "workspaceId" = current_setting('crm.workspace',true));
