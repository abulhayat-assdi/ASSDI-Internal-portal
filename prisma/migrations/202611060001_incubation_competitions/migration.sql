-- Additive upgrade: preserve all operational ids, documents, attachments and history.
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'form';
ALTER TABLE competitions ALTER COLUMN batch_name DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS competitions_id_course_id_key ON competitions(id,course_id);
ALTER TABLE incubation_programs ADD COLUMN competition_id TEXT;
ALTER TABLE incubation_catalog ADD COLUMN variant TEXT NOT NULL DEFAULT '';
DO $$ DECLARE p RECORD; cid TEXT; BEGIN
 FOR p IN SELECT * FROM incubation_programs WHERE competition_id IS NULL LOOP
  cid := gen_random_uuid()::text;
  INSERT INTO competitions(id,course_id,kind,title,description,batch_name,schema,is_active,start_date,end_date,created_at,updated_at)
   VALUES(cid,p.course_id,'business_incubation',p.name,p.description,NULL,'[]'::jsonb,p.status='active',
    ((p.start_date || ' 00:00:00+06')::timestamptz AT TIME ZONE 'UTC'),
    CASE WHEN p.end_date IS NULL THEN NULL ELSE ((p.end_date || ' 23:59:59+06')::timestamptz AT TIME ZONE 'UTC') END,p.created_at,p.updated_at);
  UPDATE incubation_programs SET competition_id=cid WHERE id=p.id;
 END LOOP;
END $$;
ALTER TABLE incubation_programs ALTER COLUMN competition_id SET NOT NULL;
CREATE UNIQUE INDEX incubation_programs_competition_id_key ON incubation_programs(competition_id);
CREATE UNIQUE INDEX incubation_programs_competition_id_course_id_key ON incubation_programs(competition_id,course_id);
ALTER TABLE incubation_programs ADD CONSTRAINT incubation_programs_competition_id_course_id_fkey FOREIGN KEY(competition_id,course_id) REFERENCES competitions(id,course_id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE competitions ADD CONSTRAINT competitions_kind_check CHECK(kind IN ('form','business_incubation'));
ALTER TABLE competitions ADD CONSTRAINT competitions_form_batch_check CHECK(kind <> 'form' OR batch_name IS NOT NULL);
