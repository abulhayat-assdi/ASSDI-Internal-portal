-- Topic-specific feedback forms. Feedback.form_id is NULL for general feedback.

CREATE TABLE "feedback_forms" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_by_uid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "feedback_forms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "feedback_forms_course_id_is_open_idx" ON "feedback_forms"("course_id", "is_open");

ALTER TABLE "feedback_forms" ADD CONSTRAINT "feedback_forms_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback" ADD COLUMN "form_id" TEXT;
CREATE INDEX "feedback_form_id_idx" ON "feedback"("form_id");
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other table.
ALTER TABLE "feedback_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_forms" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "feedback_forms"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
