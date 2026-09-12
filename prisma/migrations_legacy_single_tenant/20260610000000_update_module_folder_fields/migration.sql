-- AlterTable: add new fields to module_folders (idempotent)
ALTER TABLE "module_folders"
  ADD COLUMN IF NOT EXISTS "teacher_uid"         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "teacher_name"        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "title"               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "visible_for_batches" JSONB NOT NULL DEFAULT '["all"]',
  ADD COLUMN IF NOT EXISTS "is_hidden"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parent_folder_id"    TEXT;

-- Remove old columns that are no longer in the schema
ALTER TABLE "module_folders"
  DROP COLUMN IF EXISTS "module_id",
  DROP COLUMN IF EXISTS "module_title",
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "created_by";

-- Add self-referencing FK for sub-folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'module_folders_parent_folder_id_fkey'
  ) THEN
    ALTER TABLE "module_folders"
      ADD CONSTRAINT "module_folders_parent_folder_id_fkey"
      FOREIGN KEY ("parent_folder_id") REFERENCES "module_folders"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "module_folders_teacher_uid_idx"    ON "module_folders"("teacher_uid");
CREATE INDEX IF NOT EXISTS "module_folders_parent_folder_id_idx" ON "module_folders"("parent_folder_id");

-- AlterTable: module_resources defaults (so existing rows don't break)
ALTER TABLE "module_resources"
  ALTER COLUMN "module_id"    SET DEFAULT '',
  ALTER COLUMN "module_title" SET DEFAULT '',
  ALTER COLUMN "teacher_name" SET DEFAULT '',
  ALTER COLUMN "teacher_uid"  SET DEFAULT '';
