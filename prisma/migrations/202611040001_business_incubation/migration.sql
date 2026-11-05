-- CreateTable
CREATE TABLE "incubation_programs" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "batch_names" JSONB NOT NULL DEFAULT '[]',
    "staff_ids" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "public_token_hash" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incubation_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_teams" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incubation_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_members" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "batch_name" TEXT NOT NULL,
    "roll" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "incubation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_catalog" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "fractional" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "incubation_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_sprints" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,

    CONSTRAINT "incubation_sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_records" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "target_team_id" TEXT,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "request_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "entered_by" TEXT NOT NULL,
    "entered_by_name" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incubation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_corrections" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "before" JSONB NOT NULL,
    "proposed" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "requested_by_name" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "incubation_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_field_sessions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "check_in" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_out" TIMESTAMP(3),
    "start_area_id" TEXT NOT NULL,
    "end_area_id" TEXT,
    "start_position" JSONB NOT NULL,
    "end_position" JSONB,
    "carried" JSONB NOT NULL DEFAULT '[]',
    "steps" INTEGER NOT NULL DEFAULT 0,
    "proof_id" TEXT,

    CONSTRAINT "incubation_field_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_positions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "incubation_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_attachments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "team_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incubation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_audit" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incubation_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incubation_programs_public_token_hash_key" ON "incubation_programs"("public_token_hash");

-- CreateIndex
CREATE INDEX "incubation_programs_course_id_status_idx" ON "incubation_programs"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_programs_id_course_id_key" ON "incubation_programs"("id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_teams_id_program_id_course_id_key" ON "incubation_teams"("id", "program_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_teams_program_id_name_key" ON "incubation_teams"("program_id", "name");

-- CreateIndex
CREATE INDEX "incubation_members_course_id_batch_name_roll_idx" ON "incubation_members"("course_id", "batch_name", "roll");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_members_program_id_student_id_key" ON "incubation_members"("program_id", "student_id");

-- CreateIndex
CREATE INDEX "incubation_catalog_program_id_kind_idx" ON "incubation_catalog"("program_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_catalog_id_program_id_course_id_key" ON "incubation_catalog"("id", "program_id", "course_id");

-- CreateIndex
CREATE INDEX "incubation_sprints_program_id_team_id_start_date_idx" ON "incubation_sprints"("program_id", "team_id", "start_date");

-- CreateIndex
CREATE INDEX "incubation_records_program_id_status_date_idx" ON "incubation_records"("program_id", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_records_id_program_id_course_id_key" ON "incubation_records"("id", "program_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_records_program_id_entered_by_request_key_key" ON "incubation_records"("program_id", "entered_by", "request_key");

-- CreateIndex
CREATE INDEX "incubation_corrections_program_id_status_idx" ON "incubation_corrections"("program_id", "status");

-- CreateIndex
CREATE INDEX "incubation_field_sessions_program_id_check_in_idx" ON "incubation_field_sessions"("program_id", "check_in");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_field_sessions_id_course_id_key" ON "incubation_field_sessions"("id", "course_id");

-- CreateIndex
CREATE INDEX "incubation_positions_course_id_received_at_idx" ON "incubation_positions"("course_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_positions_session_id_captured_at_key" ON "incubation_positions"("session_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_attachments_path_key" ON "incubation_attachments"("path");

-- CreateIndex
CREATE INDEX "incubation_attachments_program_id_team_id_idx" ON "incubation_attachments"("program_id", "team_id");

-- CreateIndex
CREATE INDEX "incubation_audit_program_id_created_at_idx" ON "incubation_audit"("program_id", "created_at");

-- AddForeignKey
ALTER TABLE "incubation_programs" ADD CONSTRAINT "incubation_programs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_teams" ADD CONSTRAINT "incubation_teams_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_members" ADD CONSTRAINT "incubation_members_team_id_program_id_course_id_fkey" FOREIGN KEY ("team_id", "program_id", "course_id") REFERENCES "incubation_teams"("id", "program_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_catalog" ADD CONSTRAINT "incubation_catalog_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_sprints" ADD CONSTRAINT "incubation_sprints_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_sprints" ADD CONSTRAINT "incubation_sprints_team_id_program_id_course_id_fkey" FOREIGN KEY ("team_id", "program_id", "course_id") REFERENCES "incubation_teams"("id", "program_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_records" ADD CONSTRAINT "incubation_records_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_records" ADD CONSTRAINT "incubation_records_team_id_program_id_course_id_fkey" FOREIGN KEY ("team_id", "program_id", "course_id") REFERENCES "incubation_teams"("id", "program_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_records" ADD CONSTRAINT "incubation_records_target_team_id_program_id_course_id_fkey" FOREIGN KEY ("target_team_id", "program_id", "course_id") REFERENCES "incubation_teams"("id", "program_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_corrections" ADD CONSTRAINT "incubation_corrections_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_corrections" ADD CONSTRAINT "incubation_corrections_record_id_program_id_course_id_fkey" FOREIGN KEY ("record_id", "program_id", "course_id") REFERENCES "incubation_records"("id", "program_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_field_sessions" ADD CONSTRAINT "incubation_field_sessions_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_field_sessions" ADD CONSTRAINT "incubation_field_sessions_team_id_program_id_course_id_fkey" FOREIGN KEY ("team_id", "program_id", "course_id") REFERENCES "incubation_teams"("id", "program_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_positions" ADD CONSTRAINT "incubation_positions_session_id_course_id_fkey" FOREIGN KEY ("session_id", "course_id") REFERENCES "incubation_field_sessions"("id", "course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_attachments" ADD CONSTRAINT "incubation_attachments_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_audit" ADD CONSTRAINT "incubation_audit_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incubation_programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_programs" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_programs" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_teams" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_teams" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_members" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_catalog" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_catalog" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_sprints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_sprints" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_sprints" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_records" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_corrections" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_corrections" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_field_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_field_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_field_sessions" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_positions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_positions" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_attachments" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_attachments" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "incubation_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incubation_audit" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "incubation_audit" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

CREATE UNIQUE INDEX incubation_one_lead ON incubation_members(team_id) WHERE is_lead;
CREATE UNIQUE INDEX incubation_one_open_session ON incubation_field_sessions(course_id,user_id) WHERE check_out IS NULL;
ALTER TABLE incubation_sprints ADD CONSTRAINT incubation_sprint_dates CHECK (end_date >= start_date);
ALTER TABLE incubation_positions ADD CONSTRAINT incubation_coordinates CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND accuracy >= 0);
ALTER TABLE incubation_programs ADD CONSTRAINT incubation_program_status CHECK (status IN ('draft','active','closing','closed','archived'));
ALTER TABLE incubation_records ADD CONSTRAINT incubation_record_status CHECK (status IN ('posted','pending','transfer_pending','rejected','void'));
ALTER TABLE incubation_catalog ADD CONSTRAINT incubation_catalog_kind CHECK (kind IN ('category','product','area'));
ALTER TABLE incubation_corrections ADD CONSTRAINT incubation_correction_status CHECK (status IN ('pending','approved','rejected'));

-- AlterTable
ALTER TABLE "incubation_field_sessions" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "incubation_field_corrections" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "before" JSONB NOT NULL,
    "proposed" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "requested_by_name" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "incubation_field_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incubation_field_corrections_program_id_status_idx" ON "incubation_field_corrections"("program_id", "status");

-- AddForeignKey
ALTER TABLE "incubation_field_corrections" ADD CONSTRAINT "incubation_field_corrections_program_id_course_id_fkey" FOREIGN KEY ("program_id", "course_id") REFERENCES "incubation_programs"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_field_corrections" ADD CONSTRAINT "incubation_field_corrections_session_id_course_id_fkey" FOREIGN KEY ("session_id", "course_id") REFERENCES "incubation_field_sessions"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE incubation_field_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE incubation_field_corrections FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON incubation_field_corrections USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));
CREATE UNIQUE INDEX incubation_pending_field_correction ON incubation_field_corrections(session_id) WHERE status='pending';
CREATE UNIQUE INDEX incubation_pending_correction ON incubation_corrections(record_id) WHERE status='pending';
CREATE FUNCTION incubation_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Incubation audit history is immutable'; END $$;
CREATE TRIGGER incubation_audit_immutable BEFORE UPDATE OR DELETE ON incubation_audit FOR EACH ROW EXECUTE FUNCTION incubation_audit_immutable();

-- AlterTable
ALTER TABLE "incubation_teams" ADD COLUMN     "batch_name" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "incubation_records" ADD COLUMN     "entry_order" SERIAL NOT NULL;
