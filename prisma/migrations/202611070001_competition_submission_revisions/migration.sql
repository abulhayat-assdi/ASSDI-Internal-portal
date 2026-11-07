-- Change history for form-competition responses edited from the staff grid.
-- Additive only: no existing table or row is changed.
CREATE TABLE "competition_submission_revisions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'grid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competition_submission_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competition_submission_revisions_action_check" CHECK ("action" IN ('created', 'updated', 'deleted'))
);

CREATE INDEX "competition_submission_revisions_competition_id_created_at_idx" ON "competition_submission_revisions"("competition_id", "created_at");
CREATE INDEX "competition_submission_revisions_submission_id_idx" ON "competition_submission_revisions"("submission_id");

ALTER TABLE "competition_submission_revisions" ADD CONSTRAINT "competition_submission_revisions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competition_submission_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_submission_revisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_submission_revisions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
