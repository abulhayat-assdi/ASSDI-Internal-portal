-- Typing Exam: remove maxAttempts (replaced by unlimited retries gated by
-- a password), and generalize the retry-password field from PUBLIC-only to
-- both access types (rename public_password_hash -> retry_password_hash).
ALTER TABLE "typing_exams" DROP COLUMN "max_attempts";
ALTER TABLE "typing_exams" RENAME COLUMN "public_password_hash" TO "retry_password_hash";
