-- Remove tenant system: drop tenants table, TenantStatus enum, and all tenant_id columns

-- Drop indexes on tenant_id columns first
DROP INDEX IF EXISTS "users_tenant_id_idx";
DROP INDEX IF EXISTS "teachers_tenant_id_idx";
DROP INDEX IF EXISTS "classes_tenant_id_idx";
DROP INDEX IF EXISTS "class_schedules_tenant_id_idx";
DROP INDEX IF EXISTS "batches_tenant_id_idx";
DROP INDEX IF EXISTS "batch_students_tenant_id_idx";
DROP INDEX IF EXISTS "notices_tenant_id_idx";
DROP INDEX IF EXISTS "student_notices_tenant_id_idx";
DROP INDEX IF EXISTS "homework_submissions_tenant_id_idx";
DROP INDEX IF EXISTS "homework_assignments_tenant_id_idx";
DROP INDEX IF EXISTS "feedback_tenant_id_idx";
DROP INDEX IF EXISTS "contact_messages_tenant_id_idx";
DROP INDEX IF EXISTS "chat_threads_tenant_id_idx";
DROP INDEX IF EXISTS "activity_logs_tenant_id_idx";
DROP INDEX IF EXISTS "resources_tenant_id_idx";
DROP INDEX IF EXISTS "module_folders_tenant_id_idx";
DROP INDEX IF EXISTS "module_resources_tenant_id_idx";
DROP INDEX IF EXISTS "posts_tenant_id_idx";
DROP INDEX IF EXISTS "exam_results_tenant_id_idx";
DROP INDEX IF EXISTS "routines_tenant_id_idx";
DROP INDEX IF EXISTS "policies_tenant_id_idx";
DROP INDEX IF EXISTS "cms_content_tenant_id_idx";
DROP INDEX IF EXISTS "success_stories_tenant_id_idx";
DROP INDEX IF EXISTS "video_testimonials_tenant_id_idx";
DROP INDEX IF EXISTS "daily_tracker_reports_tenant_id_idx";
DROP INDEX IF EXISTS "student_update_requests_tenant_id_idx";
DROP INDEX IF EXISTS "batch_routine_entries_tenant_id_idx";
DROP INDEX IF EXISTS "routine_configs_tenant_id_idx";
DROP INDEX IF EXISTS "student_exam_batch_records_tenant_id_idx";
DROP INDEX IF EXISTS "course_modules_tenant_id_idx";
DROP INDEX IF EXISTS "video_stories_tenant_id_idx";

-- Drop tenant_id columns from all tables
ALTER TABLE "users" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "teachers" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "classes" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "class_schedules" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "batches" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "batch_students" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "notices" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "student_notices" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "homework_submissions" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "homework_assignments" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "feedback" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "contact_messages" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "chat_threads" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "activity_logs" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "resources" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "module_folders" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "module_resources" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "posts" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "exam_results" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "routines" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "policies" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "cms_content" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "success_stories" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "video_testimonials" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "daily_tracker_reports" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "student_update_requests" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "batch_routine_entries" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "routine_configs" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "student_exam_batch_records" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course_modules" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "video_stories" DROP COLUMN IF EXISTS "tenant_id";

-- Drop tenants table
DROP TABLE IF EXISTS "tenants";

-- Drop TenantStatus enum
DROP TYPE IF EXISTS "TenantStatus";
