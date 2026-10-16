-- Teacher class attendance: subjects admins set up, which teachers may take
-- them, and the log of classes teachers actually took.

CREATE TABLE "teaching_subjects" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teaching_subjects_course_id_name_key" ON "teaching_subjects"("course_id", "name");
CREATE INDEX "teaching_subjects_course_id_idx" ON "teaching_subjects"("course_id");

CREATE TABLE "teaching_subject_assignments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_uid" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_subject_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teaching_subject_assignments_subject_id_teacher_uid_key"
    ON "teaching_subject_assignments"("subject_id", "teacher_uid");
CREATE INDEX "teaching_subject_assignments_course_id_idx" ON "teaching_subject_assignments"("course_id");
CREATE INDEX "teaching_subject_assignments_teacher_uid_idx" ON "teaching_subject_assignments"("teacher_uid");

CREATE TABLE "teacher_class_logs" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_uid" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "subject_id" TEXT,
    "subject_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "entered_by_uid" TEXT NOT NULL,
    "entered_by_name" TEXT NOT NULL,
    "entered_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_class_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "teacher_class_logs_course_id_teacher_uid_date_idx"
    ON "teacher_class_logs"("course_id", "teacher_uid", "date");
CREATE INDEX "teacher_class_logs_course_id_date_idx" ON "teacher_class_logs"("course_id", "date");

ALTER TABLE "teaching_subjects" ADD CONSTRAINT "teaching_subjects_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_subject_assignments" ADD CONSTRAINT "teaching_subject_assignments_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "teaching_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_class_logs" ADD CONSTRAINT "teacher_class_logs_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_class_logs" ADD CONSTRAINT "teacher_class_logs_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_class_logs" ADD CONSTRAINT "teacher_class_logs_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "teaching_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other
-- tenant-scoped table (see 20260912171615_enable_row_level_security).
ALTER TABLE "teaching_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teaching_subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "teaching_subjects"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "teaching_subject_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teaching_subject_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "teaching_subject_assignments"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "teacher_class_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_class_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "teacher_class_logs"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
