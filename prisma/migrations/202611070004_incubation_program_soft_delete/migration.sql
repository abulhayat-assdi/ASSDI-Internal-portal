-- Deleting a Business Incubation program hides it everywhere but keeps its
-- records and audit history (the audit table is append-only). Additive only.
ALTER TABLE incubation_programs ADD COLUMN deleted_at TIMESTAMP(3);
ALTER TABLE incubation_programs ADD COLUMN deleted_by TEXT;
ALTER TABLE incubation_programs ADD COLUMN delete_reason TEXT;
CREATE INDEX incubation_programs_course_deleted_idx ON incubation_programs(course_id, deleted_at);
