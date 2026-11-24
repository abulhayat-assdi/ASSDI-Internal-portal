-- Homework grading: per-folder marks (optional, any total), per-submission
-- marks/feedback that the student sees only after the teacher "returns" it,
-- and a private teacher<->student comment thread per submission. Additive only.
ALTER TABLE "homework_assignments"
  ADD COLUMN "marks_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "total_marks" DOUBLE PRECISION;

ALTER TABLE "homework_submissions"
  ADD COLUMN "marks" DOUBLE PRECISION,
  ADD COLUMN "feedback" TEXT,
  ADD COLUMN "graded_at" TIMESTAMP(3),
  ADD COLUMN "graded_by_uid" TEXT,
  ADD COLUMN "graded_by_name" TEXT,
  ADD COLUMN "returned_at" TIMESTAMP(3);

CREATE TABLE "homework_comments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "author_uid" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homework_comments_submission_id_created_at_idx" ON "homework_comments"("submission_id", "created_at");
CREATE INDEX "homework_comments_course_id_idx" ON "homework_comments"("course_id");

ALTER TABLE "homework_comments" ADD CONSTRAINT "homework_comments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_comments" ADD CONSTRAINT "homework_comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "homework_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Course (tenant) isolation, same pattern as other course-scoped tables.
ALTER TABLE "homework_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "homework_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "homework_comments"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
