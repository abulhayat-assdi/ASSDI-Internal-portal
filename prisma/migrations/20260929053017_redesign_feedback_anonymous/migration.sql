/*
  Warnings:

  - You are about to drop the column `approved_by_uid` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `batch` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `company` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_from` on the `feedback` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `feedback` table. All the data in the column will be lost.
  - Added the required column `batch_name` to the `feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student_roll` to the `feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student_uid` to the `feedback` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('CourseContent', 'Teacher', 'Facilities', 'Administration', 'Other');

-- DropIndex
DROP INDEX "feedback_status_idx";

-- This table previously held the public "Student Review" testimonials
-- (name/role/company, admin-approved for the marketing site). That feature
-- is being replaced by anonymous internal course feedback, and old rows have
-- no student_uid/roll to backfill the new required columns with — nothing in
-- the app reads this table publicly (grep found no consumer), so it's safe
-- to clear before reshaping it.
DELETE FROM "feedback";

-- AlterTable
ALTER TABLE "feedback" DROP COLUMN "approved_by_uid",
DROP COLUMN "batch",
DROP COLUMN "company",
DROP COLUMN "role",
DROP COLUMN "status",
DROP COLUMN "submitted_from",
DROP COLUMN "updated_at",
ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "batch_name" TEXT NOT NULL,
ADD COLUMN     "category" "FeedbackCategory" NOT NULL DEFAULT 'Other',
ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "read_by_uid" TEXT,
ADD COLUMN     "student_roll" TEXT NOT NULL,
ADD COLUMN     "student_uid" TEXT NOT NULL;

-- DropEnum
DROP TYPE "FeedbackStatus";

-- CreateIndex
CREATE INDEX "feedback_is_read_idx" ON "feedback"("is_read");

-- CreateIndex
CREATE INDEX "feedback_category_idx" ON "feedback"("category");

-- CreateIndex
CREATE INDEX "feedback_batch_id_idx" ON "feedback"("batch_id");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
