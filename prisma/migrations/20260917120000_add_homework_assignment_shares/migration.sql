-- Homework assignment sharing: a teacher (owner) can share an assignment folder
-- with specific other teachers (view-only). One row per (assignment, teacher).
CREATE TABLE "homework_assignment_shares" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "shared_with_teacher_uid" TEXT NOT NULL,
    "shared_with_teacher_name" TEXT NOT NULL,
    "shared_by_uid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_assignment_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "homework_assignment_shares_assignment_id_shared_with_teacher_uid_key" ON "homework_assignment_shares"("assignment_id", "shared_with_teacher_uid");
CREATE INDEX "homework_assignment_shares_assignment_id_idx" ON "homework_assignment_shares"("assignment_id");
CREATE INDEX "homework_assignment_shares_shared_with_teacher_uid_idx" ON "homework_assignment_shares"("shared_with_teacher_uid");
CREATE INDEX "homework_assignment_shares_course_id_idx" ON "homework_assignment_shares"("course_id");

ALTER TABLE "homework_assignment_shares" ADD CONSTRAINT "homework_assignment_shares_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_assignment_shares" ADD CONSTRAINT "homework_assignment_shares_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "homework_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Course (tenant) isolation, same pattern as other course-scoped tables.
ALTER TABLE "homework_assignment_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "homework_assignment_shares" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "homework_assignment_shares"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
