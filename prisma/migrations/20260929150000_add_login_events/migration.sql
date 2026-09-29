-- AlterEnum
ALTER TYPE "ActorRole" ADD VALUE 'STUDENT';

-- CreateTable
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "course_id" TEXT,
    "user_id" TEXT,
    "role" "UserRole" NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_events_course_id_created_at_idx" ON "login_events"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "login_events_user_id_idx" ON "login_events"("user_id");

-- CreateIndex
CREATE INDEX "login_events_created_at_idx" ON "login_events"("created_at");

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other tenant-scoped
-- table (see 20260912171615_enable_row_level_security), with a nullable
-- course_id (same treatment as the "users" table) for super-admin-host logins.
-- This table is insert-only and is never targeted by any cleanup/TTL job —
-- login history is meant to be kept indefinitely.

ALTER TABLE "login_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "login_events"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
