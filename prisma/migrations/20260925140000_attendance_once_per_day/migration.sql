-- Attendance is called once a day per batch, by whichever teacher is free to
-- do it — not once per subject. Narrow the key to (course, batch, date) so a
-- second roll call for the same day corrects the first instead of adding a
-- parallel one under a different subject.
--
-- Collapse any same-day duplicates first, keeping the most recently updated
-- session; the rest (and their records, by cascade) go. Nothing to do on an
-- installation where this shipped before anyone used it.
DELETE FROM "attendance_sessions" a
USING "attendance_sessions" b
WHERE a."course_id" = b."course_id"
  AND a."batch_id" = b."batch_id"
  AND a."date" = b."date"
  AND (a."updated_at", a."id") < (b."updated_at", b."id");

DROP INDEX "attendance_sessions_course_id_batch_id_date_subject_key";

CREATE UNIQUE INDEX "attendance_sessions_course_id_batch_id_date_key"
    ON "attendance_sessions"("course_id", "batch_id", "date");
