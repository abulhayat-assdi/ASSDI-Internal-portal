-- Track how many times each account has successfully logged in, so
-- Super Admin > Global Users can show a login count next to last-login date.
ALTER TABLE "users" ADD COLUMN "login_count" INTEGER NOT NULL DEFAULT 0;
