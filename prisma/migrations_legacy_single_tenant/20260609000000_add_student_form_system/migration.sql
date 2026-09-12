-- Migration: Add Student Form System
-- Date: 2026-06-09
-- Description: Adds extended profile fields to batch_students,
--              creates batch_forms and student_form_submissions tables.
--              No existing data is dropped or modified.

-- ============================================================
-- 1. Add extended profile fields to batch_students
-- ============================================================

ALTER TABLE "batch_students"
  ADD COLUMN IF NOT EXISTS "email"              TEXT,
  ADD COLUMN IF NOT EXISTS "nid_birth_no"       TEXT,
  ADD COLUMN IF NOT EXISTS "father_name"        TEXT,
  ADD COLUMN IF NOT EXISTS "mother_name"        TEXT,
  ADD COLUMN IF NOT EXISTS "permanent_address"  TEXT,
  ADD COLUMN IF NOT EXISTS "guardian_name"      TEXT,
  ADD COLUMN IF NOT EXISTS "guardian_phone"     TEXT,
  ADD COLUMN IF NOT EXISTS "last_institute"     TEXT,
  ADD COLUMN IF NOT EXISTS "latest_degree"      TEXT,
  ADD COLUMN IF NOT EXISTS "gpa_result"         TEXT,
  ADD COLUMN IF NOT EXISTS "current_district"   TEXT,
  ADD COLUMN IF NOT EXISTS "home_district"      TEXT,
  ADD COLUMN IF NOT EXISTS "t_shirt_size"       TEXT,
  ADD COLUMN IF NOT EXISTS "course_goal"        TEXT;

-- ============================================================
-- 2. Create batch_forms table
-- ============================================================

CREATE TABLE IF NOT EXISTS "batch_forms" (
  "id"          TEXT         NOT NULL,
  "batch_name"  TEXT         NOT NULL,
  "form_slug"   TEXT         NOT NULL,
  "is_active"   BOOLEAN      NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "batch_forms_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "batch_forms_batch_name_key" UNIQUE ("batch_name"),
  CONSTRAINT "batch_forms_form_slug_key"  UNIQUE ("form_slug")
);

CREATE INDEX IF NOT EXISTS "batch_forms_form_slug_idx" ON "batch_forms"("form_slug");

-- ============================================================
-- 3. Create student_form_submissions table
-- ============================================================

CREATE TABLE IF NOT EXISTS "student_form_submissions" (
  "id"               TEXT         NOT NULL,
  "batch_form_id"    TEXT         NOT NULL,
  "batch_name"       TEXT         NOT NULL,
  "roll"             TEXT         NOT NULL,
  "name"             TEXT         NOT NULL,
  "phone"            TEXT         NOT NULL DEFAULT '',
  "nid_birth_no"     TEXT         NOT NULL DEFAULT '',
  "dob"              TEXT         NOT NULL DEFAULT '',
  "email"            TEXT         NOT NULL DEFAULT '',
  "blood_group"      TEXT         NOT NULL DEFAULT '',
  "father_name"      TEXT         NOT NULL DEFAULT '',
  "mother_name"      TEXT         NOT NULL DEFAULT '',
  "present_address"  TEXT         NOT NULL DEFAULT '',
  "permanent_address" TEXT        NOT NULL DEFAULT '',
  "guardian_name"    TEXT         NOT NULL DEFAULT '',
  "guardian_phone"   TEXT         NOT NULL DEFAULT '',
  "last_institute"   TEXT         NOT NULL DEFAULT '',
  "latest_degree"    TEXT         NOT NULL DEFAULT '',
  "gpa_result"       TEXT         NOT NULL DEFAULT '',
  "current_district" TEXT         NOT NULL DEFAULT '',
  "home_district"    TEXT         NOT NULL DEFAULT '',
  "category"         TEXT         NOT NULL DEFAULT '',
  "t_shirt_size"     TEXT         NOT NULL DEFAULT '',
  "course_goal"      TEXT         NOT NULL DEFAULT '',
  "status"           TEXT         NOT NULL DEFAULT 'pending',
  "admin_note"       TEXT,
  "reviewed_at"      TIMESTAMP(3),
  "submitted_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "student_form_submissions_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "student_form_submissions_batch_roll_key"    UNIQUE ("batch_name", "roll"),
  CONSTRAINT "student_form_submissions_batch_form_id_fkey"
    FOREIGN KEY ("batch_form_id")
    REFERENCES "batch_forms"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "student_form_submissions_batch_name_idx" ON "student_form_submissions"("batch_name");
CREATE INDEX IF NOT EXISTS "student_form_submissions_status_idx"     ON "student_form_submissions"("status");
