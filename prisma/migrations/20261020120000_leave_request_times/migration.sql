-- Optional start/end clock times (HH:mm) for a student leave request.
-- NULL keeps the old behaviour: whole days, both end dates included.
ALTER TABLE "student_leave_requests" ADD COLUMN "start_time" TEXT;
ALTER TABLE "student_leave_requests" ADD COLUMN "end_time" TEXT;
