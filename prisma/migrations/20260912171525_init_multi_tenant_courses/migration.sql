-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'teacher', 'student');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('PENDING', 'REQUEST_TO_COMPLETE', 'COMPLETED', 'UPCOMING');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('Scheduled', 'Completed', 'Upcoming', 'Pending', 'Today', 'Requested');

-- CreateEnum
CREATE TYPE "BatchType" AS ENUM ('Running', 'Completed');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('Running', 'Completed', 'Incomplete', 'Expelled');

-- CreateEnum
CREATE TYPE "CurrentlyDoing" AS ENUM ('Job', 'Business', 'StudyingFurther', 'Nothing');

-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('Alim', 'General');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('APPROVED', 'PENDING');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('unread', 'read', 'resolved');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('Casual', 'Sick', 'WeeklyHoliday', 'Other');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('Presentation', 'Notes', 'Assignment', 'Practice', 'Other');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#1a56db',
    "accent_color" TEXT NOT NULL DEFAULT '#f3f4f6',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "course_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "teacher_id" TEXT,
    "student_batch_name" TEXT,
    "student_roll" TEXT,
    "profile_image_url" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deployment_limit" INTEGER NOT NULL DEFAULT 5,
    "is_deployment_frozen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "login_email" TEXT NOT NULL DEFAULT '',
    "profile_image_url" TEXT,
    "image_object_position" TEXT DEFAULT 'center',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "leave_tracking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_uid" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL DEFAULT '',
    "end_time" TEXT NOT NULL DEFAULT '',
    "time_range" TEXT,
    "batch" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'PENDING',
    "completed_by_uid" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL DEFAULT '',
    "batch" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT '',
    "status" "ScheduleStatus" NOT NULL DEFAULT 'Scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_students" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "dob" TEXT,
    "educational_degree" TEXT,
    "category" "StudentCategory",
    "blood_group" TEXT,
    "total_paid_tk" TEXT,
    "course_status" "CourseStatus" NOT NULL DEFAULT 'Running',
    "currently_doing" "CurrentlyDoing",
    "company_name" TEXT NOT NULL DEFAULT '',
    "business_name" TEXT NOT NULL DEFAULT '',
    "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "photo" TEXT,
    "batch_type" "BatchType" NOT NULL DEFAULT 'Running',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "email" TEXT,
    "nid_birth_no" TEXT,
    "father_name" TEXT,
    "mother_name" TEXT,
    "permanent_address" TEXT,
    "guardian_name" TEXT,
    "guardian_phone" TEXT,
    "last_institute" TEXT,
    "latest_degree" TEXT,
    "gpa_result" TEXT,
    "current_district" TEXT,
    "home_district" TEXT,
    "t_shirt_size" TEXT,
    "course_goal" TEXT,

    CONSTRAINT "batch_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "created_by" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_notices" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "created_by" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_submissions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_uid" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_roll" TEXT NOT NULL,
    "student_batch_name" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "file_url" TEXT,
    "storage_path" TEXT,
    "file_name" TEXT,
    "files" JSONB,
    "text_content" TEXT,
    "submission_date" TEXT NOT NULL,
    "assignment_id" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_assignments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_uid" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "deadline_date" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_from" TEXT NOT NULL DEFAULT 'PUBLIC_FORM',
    "approved_by_uid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "student_uid" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_email" TEXT NOT NULL,
    "student_batch_name" TEXT NOT NULL,
    "student_roll" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'unread',
    "admin_reply" TEXT,
    "date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_uid" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_email" TEXT NOT NULL,
    "student_batch_name" TEXT NOT NULL,
    "student_roll" TEXT NOT NULL,
    "last_message_text" TEXT NOT NULL DEFAULT '',
    "last_message_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread_count_admin" INTEGER NOT NULL DEFAULT 0,
    "unread_count_student" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "actor_uid" TEXT NOT NULL,
    "actor_role" "ActorRole" NOT NULL,
    "action_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 1,
    "type" "LeaveType" NOT NULL DEFAULT 'Casual',
    "reason" TEXT,
    "month_year" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_settings" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "teacher_name" TEXT NOT NULL,
    "weekly_holidays" JSONB NOT NULL DEFAULT '[]',
    "join_date" TEXT NOT NULL,
    "last_auto_generated_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_folders" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_uid" TEXT NOT NULL DEFAULT '',
    "teacher_name" TEXT NOT NULL DEFAULT '',
    "parent_folder_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "visible_for_batches" JSONB NOT NULL DEFAULT '["all"]',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_resources" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL DEFAULT '',
    "module_title" TEXT NOT NULL DEFAULT '',
    "teacher_name" TEXT NOT NULL DEFAULT '',
    "teacher_uid" TEXT NOT NULL DEFAULT '',
    "folder_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size" TEXT,
    "resource_type" "ResourceType" NOT NULL DEFAULT 'Other',
    "visible_for_batches" JSONB NOT NULL DEFAULT '["all"]',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "featured_image" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "keywords" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_uid" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_roll" TEXT NOT NULL,
    "student_batch_name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "exam_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'policy',
    "file_url" TEXT NOT NULL DEFAULT '',
    "storage_path" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "meeting_number" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_content" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "success_stories" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "story" TEXT NOT NULL,
    "image_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "success_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_testimonials" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "video_id" TEXT NOT NULL DEFAULT '',
    "student_name" TEXT NOT NULL DEFAULT '',
    "thumbnail_url" TEXT,
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "thumbnail" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_drafts" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My CV',
    "full_name" TEXT,
    "profile_photo" TEXT,
    "career_objective" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "date_of_birth" TEXT,
    "blood_group" TEXT,
    "religion" TEXT,
    "marital_status" TEXT,
    "nationality" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "languages" JSONB NOT NULL DEFAULT '[]',
    "hobbies" JSONB NOT NULL DEFAULT '[]',
    "work_experience" JSONB NOT NULL DEFAULT '[]',
    "training" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "references" JSONB NOT NULL DEFAULT '[]',
    "declaration" TEXT,
    "signature" TEXT,
    "section_order" JSONB NOT NULL DEFAULT '["workExperience","training","education","languages","references","skills","hobbies"]',
    "linkedin" TEXT,
    "visible_sections" JSONB,
    "share_slug" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_versions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tracker_reports" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "report_data" JSONB NOT NULL,
    "submitted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_tracker_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_update_requests" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_uid" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_batch_name" TEXT NOT NULL,
    "student_roll" TEXT NOT NULL,
    "proposed_changes" JSONB NOT NULL,
    "current_data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_exam_batch_records" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_exam_batch_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pdf_link" TEXT NOT NULL DEFAULT '',
    "bullets" JSONB NOT NULL DEFAULT '[]',
    "curriculum" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_images" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_forms" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "form_slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_form_submissions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_form_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "nid_birth_no" TEXT NOT NULL DEFAULT '',
    "dob" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "blood_group" TEXT NOT NULL DEFAULT '',
    "father_name" TEXT NOT NULL DEFAULT '',
    "mother_name" TEXT NOT NULL DEFAULT '',
    "present_address" TEXT NOT NULL DEFAULT '',
    "permanent_address" TEXT NOT NULL DEFAULT '',
    "guardian_name" TEXT NOT NULL DEFAULT '',
    "guardian_phone" TEXT NOT NULL DEFAULT '',
    "last_institute" TEXT NOT NULL DEFAULT '',
    "latest_degree" TEXT NOT NULL DEFAULT '',
    "gpa_result" TEXT NOT NULL DEFAULT '',
    "current_district" TEXT NOT NULL DEFAULT '',
    "home_district" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "t_shirt_size" TEXT NOT NULL DEFAULT '',
    "course_goal" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_stories" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "youtube_url" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "student_name" TEXT NOT NULL,
    "batch" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_class_counts" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "class_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_class_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_leave_requests" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_uid" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_roll" TEXT NOT NULL,
    "student_phone" TEXT,
    "student_batch_name" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "status" "StudentLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT '',
    "folder_path" TEXT NOT NULL,
    "live_url" TEXT NOT NULL,
    "total_visitors" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_logs" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "visitor_ip" TEXT NOT NULL,
    "user_agent" TEXT,
    "date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_form_templates" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "batch_name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_submissions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "team_name" TEXT,
    "roll_number" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_groups" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT,
    "batch_name" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "members" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_slug_idx" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_course_id_idx" ON "users"("course_id");

-- CreateIndex
CREATE INDEX "users_student_batch_name_student_roll_idx" ON "users"("student_batch_name", "student_roll");

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_user_id_key" ON "active_sessions"("user_id");

-- CreateIndex
CREATE INDEX "active_sessions_expires_at_idx" ON "active_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_teacher_id_key" ON "teachers"("teacher_id");

-- CreateIndex
CREATE INDEX "teachers_teacher_id_idx" ON "teachers"("teacher_id");

-- CreateIndex
CREATE INDEX "teachers_order_idx" ON "teachers"("order");

-- CreateIndex
CREATE INDEX "teachers_course_id_idx" ON "teachers"("course_id");

-- CreateIndex
CREATE INDEX "classes_teacher_uid_idx" ON "classes"("teacher_uid");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "classes"("status");

-- CreateIndex
CREATE INDEX "classes_date_idx" ON "classes"("date");

-- CreateIndex
CREATE INDEX "classes_batch_idx" ON "classes"("batch");

-- CreateIndex
CREATE INDEX "classes_course_id_idx" ON "classes"("course_id");

-- CreateIndex
CREATE INDEX "class_schedules_teacher_id_idx" ON "class_schedules"("teacher_id");

-- CreateIndex
CREATE INDEX "class_schedules_date_idx" ON "class_schedules"("date");

-- CreateIndex
CREATE INDEX "class_schedules_batch_idx" ON "class_schedules"("batch");

-- CreateIndex
CREATE INDEX "class_schedules_course_id_idx" ON "class_schedules"("course_id");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "batches_course_id_idx" ON "batches"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batches_course_id_name_key" ON "batches"("course_id", "name");

-- CreateIndex
CREATE INDEX "batch_students_batch_name_idx" ON "batch_students"("batch_name");

-- CreateIndex
CREATE INDEX "batch_students_batch_type_idx" ON "batch_students"("batch_type");

-- CreateIndex
CREATE INDEX "batch_students_course_status_idx" ON "batch_students"("course_status");

-- CreateIndex
CREATE INDEX "batch_students_course_id_idx" ON "batch_students"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_students_course_id_batch_name_roll_key" ON "batch_students"("course_id", "batch_name", "roll");

-- CreateIndex
CREATE INDEX "notices_created_at_idx" ON "notices"("created_at");

-- CreateIndex
CREATE INDEX "notices_course_id_idx" ON "notices"("course_id");

-- CreateIndex
CREATE INDEX "student_notices_created_at_idx" ON "student_notices"("created_at");

-- CreateIndex
CREATE INDEX "student_notices_course_id_idx" ON "student_notices"("course_id");

-- CreateIndex
CREATE INDEX "homework_submissions_student_uid_idx" ON "homework_submissions"("student_uid");

-- CreateIndex
CREATE INDEX "homework_submissions_teacher_name_idx" ON "homework_submissions"("teacher_name");

-- CreateIndex
CREATE INDEX "homework_submissions_student_batch_name_idx" ON "homework_submissions"("student_batch_name");

-- CreateIndex
CREATE INDEX "homework_submissions_submitted_at_idx" ON "homework_submissions"("submitted_at");

-- CreateIndex
CREATE INDEX "homework_submissions_course_id_idx" ON "homework_submissions"("course_id");

-- CreateIndex
CREATE INDEX "homework_assignments_teacher_uid_idx" ON "homework_assignments"("teacher_uid");

-- CreateIndex
CREATE INDEX "homework_assignments_batch_name_idx" ON "homework_assignments"("batch_name");

-- CreateIndex
CREATE INDEX "homework_assignments_deadline_date_idx" ON "homework_assignments"("deadline_date");

-- CreateIndex
CREATE INDEX "homework_assignments_course_id_idx" ON "homework_assignments"("course_id");

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");

-- CreateIndex
CREATE INDEX "feedback_course_id_idx" ON "feedback"("course_id");

-- CreateIndex
CREATE INDEX "contact_messages_student_uid_idx" ON "contact_messages"("student_uid");

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_course_id_idx" ON "contact_messages"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_student_uid_key" ON "chat_threads"("student_uid");

-- CreateIndex
CREATE INDEX "chat_threads_last_message_time_idx" ON "chat_threads"("last_message_time");

-- CreateIndex
CREATE INDEX "chat_threads_course_id_idx" ON "chat_threads"("course_id");

-- CreateIndex
CREATE INDEX "chat_messages_thread_id_idx" ON "chat_messages"("thread_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_course_id_idx" ON "chat_messages"("course_id");

-- CreateIndex
CREATE INDEX "activity_logs_actor_uid_idx" ON "activity_logs"("actor_uid");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_type_idx" ON "activity_logs"("action_type");

-- CreateIndex
CREATE INDEX "activity_logs_course_id_idx" ON "activity_logs"("course_id");

-- CreateIndex
CREATE INDEX "leaves_teacher_id_idx" ON "leaves"("teacher_id");

-- CreateIndex
CREATE INDEX "leaves_month_year_idx" ON "leaves"("month_year");

-- CreateIndex
CREATE INDEX "leaves_type_idx" ON "leaves"("type");

-- CreateIndex
CREATE INDEX "leaves_course_id_idx" ON "leaves"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_settings_teacher_id_key" ON "leave_settings"("teacher_id");

-- CreateIndex
CREATE INDEX "leave_settings_course_id_idx" ON "leave_settings"("course_id");

-- CreateIndex
CREATE INDEX "resources_created_at_idx" ON "resources"("created_at");

-- CreateIndex
CREATE INDEX "resources_course_id_idx" ON "resources"("course_id");

-- CreateIndex
CREATE INDEX "module_folders_teacher_uid_idx" ON "module_folders"("teacher_uid");

-- CreateIndex
CREATE INDEX "module_folders_parent_folder_id_idx" ON "module_folders"("parent_folder_id");

-- CreateIndex
CREATE INDEX "module_folders_course_id_idx" ON "module_folders"("course_id");

-- CreateIndex
CREATE INDEX "module_resources_module_title_idx" ON "module_resources"("module_title");

-- CreateIndex
CREATE INDEX "module_resources_teacher_uid_idx" ON "module_resources"("teacher_uid");

-- CreateIndex
CREATE INDEX "module_resources_folder_id_idx" ON "module_resources"("folder_id");

-- CreateIndex
CREATE INDEX "module_resources_course_id_idx" ON "module_resources"("course_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_slug_idx" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "posts_course_id_idx" ON "posts"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "posts_course_id_slug_key" ON "posts"("course_id", "slug");

-- CreateIndex
CREATE INDEX "blog_comments_post_id_idx" ON "blog_comments"("post_id");

-- CreateIndex
CREATE INDEX "blog_comments_course_id_idx" ON "blog_comments"("course_id");

-- CreateIndex
CREATE INDEX "exam_results_student_uid_idx" ON "exam_results"("student_uid");

-- CreateIndex
CREATE INDEX "exam_results_student_batch_name_idx" ON "exam_results"("student_batch_name");

-- CreateIndex
CREATE INDEX "exam_results_course_id_idx" ON "exam_results"("course_id");

-- CreateIndex
CREATE INDEX "routines_batch_name_idx" ON "routines"("batch_name");

-- CreateIndex
CREATE INDEX "routines_course_id_idx" ON "routines"("course_id");

-- CreateIndex
CREATE INDEX "policies_kind_idx" ON "policies"("kind");

-- CreateIndex
CREATE INDEX "policies_sort_order_idx" ON "policies"("sort_order");

-- CreateIndex
CREATE INDEX "policies_course_id_idx" ON "policies"("course_id");

-- CreateIndex
CREATE INDEX "cms_content_course_id_idx" ON "cms_content"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_content_course_id_key_key" ON "cms_content"("course_id", "key");

-- CreateIndex
CREATE INDEX "success_stories_is_published_idx" ON "success_stories"("is_published");

-- CreateIndex
CREATE INDEX "success_stories_course_id_idx" ON "success_stories"("course_id");

-- CreateIndex
CREATE INDEX "video_testimonials_is_published_idx" ON "video_testimonials"("is_published");

-- CreateIndex
CREATE INDEX "video_testimonials_order_idx" ON "video_testimonials"("order");

-- CreateIndex
CREATE INDEX "video_testimonials_course_id_idx" ON "video_testimonials"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "cv_templates_slug_key" ON "cv_templates"("slug");

-- CreateIndex
CREATE INDEX "cv_templates_is_active_idx" ON "cv_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cv_drafts_share_slug_key" ON "cv_drafts"("share_slug");

-- CreateIndex
CREATE INDEX "cv_drafts_user_id_idx" ON "cv_drafts"("user_id");

-- CreateIndex
CREATE INDEX "cv_drafts_template_id_idx" ON "cv_drafts"("template_id");

-- CreateIndex
CREATE INDEX "cv_drafts_share_slug_idx" ON "cv_drafts"("share_slug");

-- CreateIndex
CREATE INDEX "cv_drafts_created_at_idx" ON "cv_drafts"("created_at");

-- CreateIndex
CREATE INDEX "cv_drafts_course_id_idx" ON "cv_drafts"("course_id");

-- CreateIndex
CREATE INDEX "cv_versions_draft_id_idx" ON "cv_versions"("draft_id");

-- CreateIndex
CREATE INDEX "cv_versions_created_at_idx" ON "cv_versions"("created_at");

-- CreateIndex
CREATE INDEX "cv_versions_course_id_idx" ON "cv_versions"("course_id");

-- CreateIndex
CREATE INDEX "daily_tracker_reports_batch_name_idx" ON "daily_tracker_reports"("batch_name");

-- CreateIndex
CREATE INDEX "daily_tracker_reports_date_idx" ON "daily_tracker_reports"("date");

-- CreateIndex
CREATE INDEX "daily_tracker_reports_course_id_idx" ON "daily_tracker_reports"("course_id");

-- CreateIndex
CREATE INDEX "student_update_requests_student_uid_idx" ON "student_update_requests"("student_uid");

-- CreateIndex
CREATE INDEX "student_update_requests_status_idx" ON "student_update_requests"("status");

-- CreateIndex
CREATE INDEX "student_update_requests_course_id_idx" ON "student_update_requests"("course_id");

-- CreateIndex
CREATE INDEX "student_exam_batch_records_batch_name_idx" ON "student_exam_batch_records"("batch_name");

-- CreateIndex
CREATE INDEX "student_exam_batch_records_course_id_idx" ON "student_exam_batch_records"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_exam_batch_records_course_id_batch_name_roll_key" ON "student_exam_batch_records"("course_id", "batch_name", "roll");

-- CreateIndex
CREATE INDEX "course_modules_slug_idx" ON "course_modules"("slug");

-- CreateIndex
CREATE INDEX "course_modules_order_idx" ON "course_modules"("order");

-- CreateIndex
CREATE INDEX "course_modules_course_id_idx" ON "course_modules"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_course_id_slug_key" ON "course_modules"("course_id", "slug");

-- CreateIndex
CREATE INDEX "hero_images_order_idx" ON "hero_images"("order");

-- CreateIndex
CREATE INDEX "hero_images_is_active_idx" ON "hero_images"("is_active");

-- CreateIndex
CREATE INDEX "hero_images_course_id_idx" ON "hero_images"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_forms_form_slug_key" ON "batch_forms"("form_slug");

-- CreateIndex
CREATE INDEX "batch_forms_form_slug_idx" ON "batch_forms"("form_slug");

-- CreateIndex
CREATE INDEX "batch_forms_course_id_idx" ON "batch_forms"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_forms_course_id_batch_name_key" ON "batch_forms"("course_id", "batch_name");

-- CreateIndex
CREATE INDEX "student_form_submissions_batch_name_idx" ON "student_form_submissions"("batch_name");

-- CreateIndex
CREATE INDEX "student_form_submissions_status_idx" ON "student_form_submissions"("status");

-- CreateIndex
CREATE INDEX "student_form_submissions_course_id_idx" ON "student_form_submissions"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_form_submissions_course_id_batch_name_roll_key" ON "student_form_submissions"("course_id", "batch_name", "roll");

-- CreateIndex
CREATE INDEX "video_stories_order_idx" ON "video_stories"("order");

-- CreateIndex
CREATE INDEX "video_stories_course_id_idx" ON "video_stories"("course_id");

-- CreateIndex
CREATE INDEX "batch_class_counts_course_id_idx" ON "batch_class_counts"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_class_counts_course_id_batch_name_subject_name_key" ON "batch_class_counts"("course_id", "batch_name", "subject_name");

-- CreateIndex
CREATE INDEX "student_leave_requests_student_uid_idx" ON "student_leave_requests"("student_uid");

-- CreateIndex
CREATE INDEX "student_leave_requests_student_batch_name_idx" ON "student_leave_requests"("student_batch_name");

-- CreateIndex
CREATE INDEX "student_leave_requests_student_roll_idx" ON "student_leave_requests"("student_roll");

-- CreateIndex
CREATE INDEX "student_leave_requests_student_phone_idx" ON "student_leave_requests"("student_phone");

-- CreateIndex
CREATE INDEX "student_leave_requests_status_idx" ON "student_leave_requests"("status");

-- CreateIndex
CREATE INDEX "student_leave_requests_course_id_idx" ON "student_leave_requests"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "deployments_subdomain_key" ON "deployments"("subdomain");

-- CreateIndex
CREATE INDEX "deployments_user_id_idx" ON "deployments"("user_id");

-- CreateIndex
CREATE INDEX "deployments_subdomain_idx" ON "deployments"("subdomain");

-- CreateIndex
CREATE INDEX "deployments_course_id_idx" ON "deployments"("course_id");

-- CreateIndex
CREATE INDEX "visitor_logs_deployment_id_idx" ON "visitor_logs"("deployment_id");

-- CreateIndex
CREATE INDEX "visitor_logs_date_idx" ON "visitor_logs"("date");

-- CreateIndex
CREATE INDEX "visitor_logs_course_id_idx" ON "visitor_logs"("course_id");

-- CreateIndex
CREATE INDEX "competition_form_templates_course_id_idx" ON "competition_form_templates"("course_id");

-- CreateIndex
CREATE INDEX "competitions_batch_name_idx" ON "competitions"("batch_name");

-- CreateIndex
CREATE INDEX "competitions_course_id_idx" ON "competitions"("course_id");

-- CreateIndex
CREATE INDEX "competition_submissions_competition_id_idx" ON "competition_submissions"("competition_id");

-- CreateIndex
CREATE INDEX "competition_submissions_type_idx" ON "competition_submissions"("type");

-- CreateIndex
CREATE INDEX "competition_submissions_course_id_idx" ON "competition_submissions"("course_id");

-- CreateIndex
CREATE INDEX "competition_groups_batch_name_idx" ON "competition_groups"("batch_name");

-- CreateIndex
CREATE INDEX "competition_groups_competition_id_idx" ON "competition_groups"("competition_id");

-- CreateIndex
CREATE INDEX "competition_groups_course_id_idx" ON "competition_groups"("course_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_students" ADD CONSTRAINT "batch_students_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_students" ADD CONSTRAINT "batch_students_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notices" ADD CONSTRAINT "student_notices_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_uid_fkey" FOREIGN KEY ("actor_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_folders" ADD CONSTRAINT "module_folders_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_folders" ADD CONSTRAINT "module_folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "module_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "module_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_content" ADD CONSTRAINT "cms_content_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "success_stories" ADD CONSTRAINT "success_stories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_testimonials" ADD CONSTRAINT "video_testimonials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "cv_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "cv_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tracker_reports" ADD CONSTRAINT "daily_tracker_reports_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_update_requests" ADD CONSTRAINT "student_update_requests_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_exam_batch_records" ADD CONSTRAINT "student_exam_batch_records_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_images" ADD CONSTRAINT "hero_images_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_forms" ADD CONSTRAINT "batch_forms_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_form_submissions" ADD CONSTRAINT "student_form_submissions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_form_submissions" ADD CONSTRAINT "student_form_submissions_batch_form_id_fkey" FOREIGN KEY ("batch_form_id") REFERENCES "batch_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_stories" ADD CONSTRAINT "video_stories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_class_counts" ADD CONSTRAINT "batch_class_counts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_form_templates" ADD CONSTRAINT "competition_form_templates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_groups" ADD CONSTRAINT "competition_groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
