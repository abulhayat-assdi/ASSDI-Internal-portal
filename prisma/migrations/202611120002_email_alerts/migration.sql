-- Email alerts: a log of automated emails (also used to avoid sending the
-- same alert twice) and an optional guardian email. Additive only.

ALTER TABLE "batch_students" ADD COLUMN "guardian_email" TEXT;
ALTER TABLE "student_form_submissions" ADD COLUMN "guardian_email" TEXT NOT NULL DEFAULT '';

CREATE TABLE "email_logs" (
  "id" TEXT PRIMARY KEY,
  "course_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_logs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "email_logs_course_id_dedupe_key_key" ON "email_logs"("course_id", "dedupe_key");
CREATE INDEX "email_logs_course_id_created_at_idx" ON "email_logs"("course_id", "created_at");
CREATE INDEX "email_logs_course_id_kind_idx" ON "email_logs"("course_id", "kind");

ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "email_logs" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));
