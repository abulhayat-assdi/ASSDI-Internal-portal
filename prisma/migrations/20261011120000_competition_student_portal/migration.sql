-- AlterTable
ALTER TABLE "competition_submissions" ADD COLUMN "group_id" TEXT,
ADD COLUMN "report_date" TEXT;

-- CreateTable
CREATE TABLE "competition_correction_requests" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "requester_roll" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "new_data" JSONB NOT NULL,
    "old_data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_correction_requests_course_id_status_idx" ON "competition_correction_requests"("course_id", "status");

-- CreateIndex
CREATE INDEX "competition_correction_requests_competition_id_idx" ON "competition_correction_requests"("competition_id");

-- CreateIndex
CREATE INDEX "competition_correction_requests_submission_id_idx" ON "competition_correction_requests"("submission_id");

-- AddForeignKey
ALTER TABLE "competition_correction_requests" ADD CONSTRAINT "competition_correction_requests_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_correction_requests" ADD CONSTRAINT "competition_correction_requests_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_correction_requests" ADD CONSTRAINT "competition_correction_requests_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "competition_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other
-- tenant-scoped table (see 20260912171615_enable_row_level_security).
ALTER TABLE "competition_correction_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_correction_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_correction_requests"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
