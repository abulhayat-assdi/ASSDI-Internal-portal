-- Remove the teacher Leave Tracking feature: drop its tables (and their RLS
-- policies with them), the LeaveType enum, and the per-teacher opt-in flag.
-- Student leave requests (student_leave_requests) are a separate feature and untouched.
DROP TABLE IF EXISTS "leave_settings";
DROP TABLE IF EXISTS "leaves";
DROP TYPE IF EXISTS "LeaveType";
ALTER TABLE "teachers" DROP COLUMN IF EXISTS "leave_tracking_enabled";
