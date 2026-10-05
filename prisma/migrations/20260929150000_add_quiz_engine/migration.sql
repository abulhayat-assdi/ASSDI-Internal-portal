-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "QuizOptionLabelStyle" AS ENUM ('LETTERS', 'NUMBERS', 'ROMAN');

-- CreateEnum
CREATE TYPE "QuizResultReleaseMode" AS ENUM ('IMMEDIATE', 'HELD');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AWAITING_GRADING', 'GRADED');

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description_html" TEXT NOT NULL DEFAULT '',
    "batch_names" JSONB NOT NULL DEFAULT '[]',
    "option_label_style" "QuizOptionLabelStyle" NOT NULL DEFAULT 'LETTERS',
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT true,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT true,
    "allow_backtrack" BOOLEAN NOT NULL DEFAULT true,
    "duration_seconds" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "practice_mode_allowed" BOOLEAN NOT NULL DEFAULT false,
    "negative_mark_per_wrong" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pass_percentage" DOUBLE PRECISION,
    "result_release_mode" "QuizResultReleaseMode" NOT NULL DEFAULT 'IMMEDIATE',
    "result_release_at" TIMESTAMP(3),
    "results_released_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "schedule_start" TIMESTAMP(3),
    "schedule_end" TIMESTAMP(3),
    "created_by_uid" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL DEFAULT '',
    "created_by_role" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" "QuizQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "body_html" TEXT NOT NULL DEFAULT '',
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "explanation_html" TEXT NOT NULL DEFAULT '',
    "tag" TEXT,
    "difficulty" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "source_bank_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_question_bank_items" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "type" "QuizQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "body_html" TEXT NOT NULL DEFAULT '',
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "explanation_html" TEXT NOT NULL DEFAULT '',
    "tag" TEXT,
    "difficulty" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "created_by_uid" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_question_bank_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "student_user_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL DEFAULT '',
    "student_roll" TEXT NOT NULL DEFAULT '',
    "student_batch_name" TEXT NOT NULL DEFAULT '',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "is_practice" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "question_order" JSONB NOT NULL DEFAULT '[]',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_marks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passed" BOOLEAN,
    "tab_switch_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "duration_taken_seconds" INTEGER,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_option_ids" JSONB NOT NULL DEFAULT '[]',
    "short_answer_text" TEXT,
    "is_correct" BOOLEAN,
    "marks_awarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quizzes_course_id_idx" ON "quizzes"("course_id");

-- CreateIndex
CREATE INDEX "quizzes_is_active_idx" ON "quizzes"("is_active");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_questions_course_id_idx" ON "quiz_questions"("course_id");

-- CreateIndex
CREATE INDEX "quiz_question_bank_items_course_id_idx" ON "quiz_question_bank_items"("course_id");

-- CreateIndex
CREATE INDEX "quiz_question_bank_items_tag_idx" ON "quiz_question_bank_items"("tag");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_student_user_id_idx" ON "quiz_attempts"("student_user_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_course_id_idx" ON "quiz_attempts"("course_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_status_idx" ON "quiz_attempts"("status");

-- CreateIndex
CREATE INDEX "quiz_answers_attempt_id_idx" ON "quiz_answers"("attempt_id");

-- CreateIndex
CREATE INDEX "quiz_answers_question_id_idx" ON "quiz_answers"("question_id");

-- CreateIndex
CREATE INDEX "quiz_answers_course_id_idx" ON "quiz_answers"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answers_attempt_id_question_id_key" ON "quiz_answers"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question_bank_items" ADD CONSTRAINT "quiz_question_bank_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other tenant-scoped
-- table (see 20260912171615_enable_row_level_security and 20260914063724_add_typing_exam).
-- FORCE is required because the Prisma connection uses the table-owning role.

ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "quizzes"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "quiz_questions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "quiz_question_bank_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_question_bank_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "quiz_question_bank_items"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "quiz_attempts"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "quiz_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "quiz_answers"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
