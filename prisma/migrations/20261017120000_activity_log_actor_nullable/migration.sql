-- activity_logs.actor_uid is ON DELETE SET NULL, so the column must allow NULL;
-- otherwise permanently deleting a user who has logged any activity fails.
ALTER TABLE "activity_logs" ALTER COLUMN "actor_uid" DROP NOT NULL;
