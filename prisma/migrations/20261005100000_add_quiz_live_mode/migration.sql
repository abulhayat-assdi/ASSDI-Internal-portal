
-- CreateEnum
CREATE TYPE "QuizLiveStatus" AS ENUM ('LOBBY', 'QUESTION', 'REVEAL', 'FINISHED');

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "leaderboard_show_names" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_leaderboard" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "time_limit_seconds" INTEGER;

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "live_session_id" TEXT;

-- AlterTable
ALTER TABLE "quiz_answers" ADD COLUMN     "response_ms" INTEGER;

-- CreateTable
CREATE TABLE "quiz_live_sessions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "status" "QuizLiveStatus" NOT NULL DEFAULT 'LOBBY',
    "question_order" JSONB NOT NULL DEFAULT '[]',
    "current_index" INTEGER NOT NULL DEFAULT -1,
    "question_started_at" TIMESTAMP(3),
    "default_question_seconds" INTEGER NOT NULL DEFAULT 20,
    "host_uid" TEXT NOT NULL,
    "host_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "quiz_live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_live_sessions_course_id_idx" ON "quiz_live_sessions"("course_id");

-- CreateIndex
CREATE INDEX "quiz_live_sessions_quiz_id_idx" ON "quiz_live_sessions"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_live_sessions_join_code_idx" ON "quiz_live_sessions"("join_code");

-- CreateIndex
CREATE INDEX "quiz_attempts_live_session_id_idx" ON "quiz_attempts"("live_session_id");

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "quiz_live_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_live_sessions" ADD CONSTRAINT "quiz_live_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_live_sessions" ADD CONSTRAINT "quiz_live_sessions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-Level Security (same course-isolation policy as the other quiz tables).
ALTER TABLE "quiz_live_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_live_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "quiz_live_sessions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
