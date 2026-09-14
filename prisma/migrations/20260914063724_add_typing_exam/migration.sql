-- CreateEnum
CREATE TYPE "TypingExamAccessType" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TypingExamTextSource" AS ENUM ('CUSTOM', 'BANK');

-- CreateEnum
CREATE TYPE "TypingExamTakerType" AS ENUM ('STUDENT', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TypingExamResult" AS ENUM ('PASS', 'AVERAGE', 'FAIL');

-- CreateTable
CREATE TABLE "typing_exams" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "access_type" "TypingExamAccessType" NOT NULL DEFAULT 'INTERNAL',
    "batch_names" JSONB NOT NULL DEFAULT '[]',
    "duration_seconds" INTEGER NOT NULL DEFAULT 60,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "pass_wpm" DOUBLE PRECISION NOT NULL,
    "pass_accuracy" DOUBLE PRECISION NOT NULL,
    "fail_wpm" DOUBLE PRECISION NOT NULL,
    "fail_accuracy" DOUBLE PRECISION NOT NULL,
    "text_source" "TypingExamTextSource" NOT NULL DEFAULT 'CUSTOM',
    "text_language" TEXT NOT NULL DEFAULT 'en',
    "exam_text" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "schedule_start" TIMESTAMP(3),
    "schedule_end" TIMESTAMP(3),
    "public_slug" TEXT,
    "public_password_hash" TEXT,
    "created_by_uid" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL DEFAULT '',
    "created_by_role" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "typing_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typing_exam_attempts" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "taker_type" "TypingExamTakerType" NOT NULL,
    "student_user_id" TEXT,
    "student_name" TEXT NOT NULL DEFAULT '',
    "student_roll" TEXT NOT NULL DEFAULT '',
    "student_batch_name" TEXT NOT NULL DEFAULT '',
    "public_name" TEXT NOT NULL DEFAULT '',
    "public_roll" TEXT NOT NULL DEFAULT '',
    "public_phone" TEXT NOT NULL DEFAULT '',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "wpm" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "correct_chars" INTEGER NOT NULL DEFAULT 0,
    "total_chars" INTEGER NOT NULL DEFAULT 0,
    "duration_taken_seconds" INTEGER NOT NULL DEFAULT 0,
    "result" "TypingExamResult" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "typing_exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "typing_exams_public_slug_key" ON "typing_exams"("public_slug");

-- CreateIndex
CREATE INDEX "typing_exams_course_id_idx" ON "typing_exams"("course_id");

-- CreateIndex
CREATE INDEX "typing_exams_access_type_idx" ON "typing_exams"("access_type");

-- CreateIndex
CREATE INDEX "typing_exams_is_active_idx" ON "typing_exams"("is_active");

-- CreateIndex
CREATE INDEX "typing_exams_public_slug_idx" ON "typing_exams"("public_slug");

-- CreateIndex
CREATE INDEX "typing_exam_attempts_exam_id_idx" ON "typing_exam_attempts"("exam_id");

-- CreateIndex
CREATE INDEX "typing_exam_attempts_student_user_id_idx" ON "typing_exam_attempts"("student_user_id");

-- CreateIndex
CREATE INDEX "typing_exam_attempts_public_phone_idx" ON "typing_exam_attempts"("public_phone");

-- CreateIndex
CREATE INDEX "typing_exam_attempts_course_id_idx" ON "typing_exam_attempts"("course_id");

-- AddForeignKey
ALTER TABLE "typing_exams" ADD CONSTRAINT "typing_exams_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typing_exam_attempts" ADD CONSTRAINT "typing_exam_attempts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typing_exam_attempts" ADD CONSTRAINT "typing_exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "typing_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other tenant-scoped
-- table (see 20260912171615_enable_row_level_security). FORCE is required
-- because the Prisma connection uses the table-owning role.

ALTER TABLE "typing_exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "typing_exams" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "typing_exams"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "typing_exam_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "typing_exam_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "typing_exam_attempts"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
