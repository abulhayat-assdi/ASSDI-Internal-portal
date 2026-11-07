-- In-app reminders and published (frozen) results for Business Incubation.
-- Additive only: no existing table or row is changed.
CREATE TABLE incubation_notifications (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP(3),
  emailed_at TIMESTAMP(3),
  CONSTRAINT incubation_notifications_program_fkey FOREIGN KEY (program_id, course_id) REFERENCES incubation_programs(id, course_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX incubation_notifications_user_event_key ON incubation_notifications(user_id, event_key);
CREATE INDEX incubation_notifications_user_read_idx ON incubation_notifications(user_id, read_at);
CREATE INDEX incubation_notifications_program_created_idx ON incubation_notifications(program_id, created_at);

CREATE TABLE incubation_results (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  published_by TEXT NOT NULL,
  published_by_name TEXT NOT NULL,
  published_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TIMESTAMP(3),
  CONSTRAINT incubation_results_program_fkey FOREIGN KEY (program_id, course_id) REFERENCES incubation_programs(id, course_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX incubation_results_program_idx ON incubation_results(program_id, published_at);

ALTER TABLE incubation_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubation_notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON incubation_notifications USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));
ALTER TABLE incubation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubation_results FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON incubation_results USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));
