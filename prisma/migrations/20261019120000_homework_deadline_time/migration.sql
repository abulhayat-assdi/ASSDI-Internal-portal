-- Optional cut-off time (HH:mm, Asia/Dhaka) for a homework folder.
-- NULL keeps the old behaviour: open through the end of deadline_date.
ALTER TABLE "homework_assignments" ADD COLUMN "deadline_time" TEXT;
