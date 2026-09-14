-- AlterTable
ALTER TABLE "course_modules" ADD COLUMN     "teacher_email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "teacher_name" TEXT NOT NULL DEFAULT '';
