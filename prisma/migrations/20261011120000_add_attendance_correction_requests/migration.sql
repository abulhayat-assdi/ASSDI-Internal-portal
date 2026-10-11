-- A student can ask for one day of their attendance to be corrected; an admin
-- approves or rejects it, and an approval rewrites that day's record.

CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "attendance_correction_requests" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "current_status" "AttendanceStatus" NOT NULL,
    "requested_status" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_uid" TEXT,
    "reviewed_by_name" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_correction_requests_course_id_idx" ON "attendance_correction_requests"("course_id");
CREATE INDEX "attendance_correction_requests_session_id_idx" ON "attendance_correction_requests"("session_id");
CREATE INDEX "attendance_correction_requests_student_id_idx" ON "attendance_correction_requests"("student_id");
CREATE INDEX "attendance_correction_requests_status_idx" ON "attendance_correction_requests"("status");

-- One open request per student per day: a second one would only race the first.
CREATE UNIQUE INDEX "attendance_correction_requests_one_pending_key"
    ON "attendance_correction_requests"("session_id", "student_id")
    WHERE "status" = 'PENDING';

ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "batch_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Course (tenant) isolation, same pattern as every other course-scoped table.
ALTER TABLE "attendance_correction_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_correction_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "attendance_correction_requests"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
