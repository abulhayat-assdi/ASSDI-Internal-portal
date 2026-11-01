-- Required option references are scoped at the database layer too.
ALTER TABLE "Complaint" ADD CONSTRAINT caller_option_fk FOREIGN KEY ("workspaceId","callerType") REFERENCES "Option"("workspaceId","id");
ALTER TABLE "Complaint" ADD CONSTRAINT channel_option_fk FOREIGN KEY ("workspaceId","channel") REFERENCES "Option"("workspaceId","id");
ALTER TABLE "Complaint" ADD CONSTRAINT complaint_option_fk FOREIGN KEY ("workspaceId","complaintType") REFERENCES "Option"("workspaceId","id");
ALTER TABLE "Complaint" ADD CONSTRAINT issue_option_fk FOREIGN KEY ("workspaceId","issueType") REFERENCES "Option"("workspaceId","id");
CREATE FUNCTION crm_validate_tags() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tag_id text;
BEGIN
 FOR tag_id IN SELECT DISTINCT unnest(NEW.tags || ARRAY[NEW."primaryTag"]) LOOP
  IF tag_id <> '' AND NOT EXISTS (SELECT 1 FROM "Option" WHERE "workspaceId"=NEW."workspaceId" AND id=tag_id AND kind='tag') THEN RAISE EXCEPTION 'Tag outside complaint workspace'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER complaint_tags_scope BEFORE INSERT OR UPDATE OF tags,"primaryTag" ON "Complaint" FOR EACH ROW EXECUTE FUNCTION crm_validate_tags();
