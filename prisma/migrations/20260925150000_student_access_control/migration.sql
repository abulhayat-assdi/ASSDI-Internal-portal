-- Losing your place on the course now closes the portal with you, and a roll
-- number can only be claimed by one email unless an admin reopens it.
ALTER TABLE "batch_students"
    ADD COLUMN "registration_unlocked" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "access_blocked_at" TIMESTAMP(3);

-- Students already marked Incomplete or Expelled are blocked from today, not
-- retroactively: their block date is set to now so the notice they see has
-- something truthful to show.
UPDATE "batch_students"
SET "access_blocked_at" = CURRENT_TIMESTAMP
WHERE "course_status" IN ('Incomplete', 'Expelled');

-- Attendance and the report screens look students up by (batch, roll); the
-- access check now does too, on every request a student makes.
CREATE INDEX IF NOT EXISTS "batch_students_batch_name_roll_idx"
    ON "batch_students"("course_id", "batch_name", "roll");
