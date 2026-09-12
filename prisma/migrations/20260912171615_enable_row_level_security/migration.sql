-- Row-Level Security: enforce course (tenant) isolation at the database level.
--
-- Every request must set two Postgres session variables (via SET LOCAL, inside
-- a transaction) before running any query:
--   app.current_course_id  -> the course id the request is scoped to (from JWT/subdomain)
--   app.is_super_admin     -> 'true' for super_admin sessions, which bypass course scoping
--
-- FORCE ROW LEVEL SECURITY is required on every table because the Prisma connection
-- uses the table-owning role; without FORCE, Postgres exempts owners from RLS by default
-- and the policies below would silently do nothing.

-- The tenant table itself: a course-scoped session may only see/touch its own row.
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "courses"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "users"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "teachers"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classes" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "classes"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "class_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "class_schedules"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "batches"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "batch_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batch_students" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "batch_students"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notices" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "notices"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "student_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_notices" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "student_notices"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "homework_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "homework_submissions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "homework_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "homework_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "homework_assignments"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "feedback"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "contact_messages"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "chat_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_threads" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "chat_threads"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "chat_messages"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "activity_logs"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leaves" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "leaves"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "leave_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "leave_settings"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "resources"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "module_folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "module_folders" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "module_folders"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "module_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "module_resources" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "module_resources"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "posts"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "blog_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blog_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "blog_comments"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "exam_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_results" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "exam_results"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "routines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routines" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "routines"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "policies"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "cms_content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cms_content" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "cms_content"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "success_stories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "success_stories" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "success_stories"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "video_testimonials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_testimonials" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "video_testimonials"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "cv_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cv_drafts" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "cv_drafts"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "cv_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cv_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "cv_versions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "daily_tracker_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_tracker_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "daily_tracker_reports"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "student_update_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_update_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "student_update_requests"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "student_exam_batch_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_exam_batch_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "student_exam_batch_records"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_modules" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "course_modules"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "hero_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hero_images" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "hero_images"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "batch_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batch_forms" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "batch_forms"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "student_form_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_form_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "student_form_submissions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "video_stories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_stories" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "video_stories"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "batch_class_counts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batch_class_counts" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "batch_class_counts"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "student_leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_leave_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "student_leave_requests"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "deployments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deployments" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "deployments"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "visitor_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitor_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "visitor_logs"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "competition_form_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_form_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_form_templates"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "competitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competitions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "competition_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_submissions"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "competition_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_groups" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_groups"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
