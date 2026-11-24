-- Field sessions a student forgot to end are closed automatically at 23:00
-- Asia/Dhaka of the check-in day; this marks them so staff and students can tell.
-- Additive only.
ALTER TABLE incubation_field_sessions ADD COLUMN auto_checkout BOOLEAN NOT NULL DEFAULT false;
