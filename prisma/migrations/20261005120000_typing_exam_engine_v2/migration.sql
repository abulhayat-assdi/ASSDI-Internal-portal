-- Typing exam engine v2: server-side sessions with autosave + an audit trail
-- on every attempt (typed text, keystrokes, finish reason).
-- CreateEnum
CREATE TYPE "TypingExamFinishReason" AS ENUM ('TIME_UP', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TypingExamSessionStatus" AS ENUM ('OPEN', 'FINALIZED', 'DISCARDED');

-- AlterTable
ALTER TABLE "typing_exam_attempts" ADD COLUMN     "engine_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "finish_reason" "TypingExamFinishReason",
ADD COLUMN     "keystrokes_correct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keystrokes_total" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "raw_wpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "typed_text" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "typing_exam_sessions" (
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
    "token_hash" TEXT NOT NULL DEFAULT '',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" "TypingExamSessionStatus" NOT NULL DEFAULT 'OPEN',
    "typed_text" TEXT NOT NULL DEFAULT '',
    "keystrokes_total" INTEGER NOT NULL DEFAULT 0,
    "keystrokes_correct" INTEGER NOT NULL DEFAULT 0,
    "elapsed_ms" INTEGER NOT NULL DEFAULT 0,
    "finish_reason" "TypingExamFinishReason",
    "attempt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_progress_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "typing_exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "typing_exam_sessions_attempt_id_key" ON "typing_exam_sessions"("attempt_id");

-- CreateIndex
CREATE INDEX "typing_exam_sessions_exam_id_status_idx" ON "typing_exam_sessions"("exam_id", "status");

-- CreateIndex
CREATE INDEX "typing_exam_sessions_student_user_id_idx" ON "typing_exam_sessions"("student_user_id");

-- CreateIndex
CREATE INDEX "typing_exam_sessions_public_phone_idx" ON "typing_exam_sessions"("public_phone");

-- CreateIndex
CREATE INDEX "typing_exam_sessions_course_id_idx" ON "typing_exam_sessions"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "typing_exam_attempts_session_id_key" ON "typing_exam_attempts"("session_id");

-- AddForeignKey
ALTER TABLE "typing_exam_sessions" ADD CONSTRAINT "typing_exam_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typing_exam_sessions" ADD CONSTRAINT "typing_exam_sessions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "typing_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other tenant-scoped
-- table (see 20260912171615_enable_row_level_security).

ALTER TABLE "typing_exam_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "typing_exam_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "typing_exam_sessions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
