-- Batch-wise student notices. Existing notices keep showing to every batch.

-- AlterTable
ALTER TABLE "student_notices" ADD COLUMN "batch_name" TEXT NOT NULL DEFAULT 'all';

-- CreateIndex
CREATE INDEX "student_notices_course_id_batch_name_idx" ON "student_notices"("course_id", "batch_name");
