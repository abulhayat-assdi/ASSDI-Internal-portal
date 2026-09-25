-- Class attendance: one roll call per batch/day/subject, with one record per
-- student. Everything else in the portal (leave, homework, results) already
-- assumed attendance existed; this is the table that was missing.

CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "taken_by_uid" TEXT NOT NULL,
    "taken_by_name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- One roll call per batch, day and subject: saving the same slot twice
-- updates the first rather than double-counting the day.
CREATE UNIQUE INDEX "attendance_sessions_course_id_batch_id_date_subject_key"
    ON "attendance_sessions"("course_id", "batch_id", "date", "subject");
CREATE INDEX "attendance_sessions_course_id_idx" ON "attendance_sessions"("course_id");
CREATE INDEX "attendance_sessions_batch_id_idx" ON "attendance_sessions"("batch_id");
CREATE INDEX "attendance_sessions_date_idx" ON "attendance_sessions"("date");

CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key"
    ON "attendance_records"("session_id", "student_id");
CREATE INDEX "attendance_records_course_id_idx" ON "attendance_records"("course_id");
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records"("student_id");
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "batch_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Course (tenant) isolation, same pattern as every other course-scoped table.
ALTER TABLE "attendance_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "attendance_sessions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "attendance_records"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
