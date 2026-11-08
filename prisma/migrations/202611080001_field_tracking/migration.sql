-- Competition field tracking from the Android app (docs/ANDROID_PORTAL_APP_PLAN.md).
-- Generated with prisma migrate diff, then RLS, a coordinates CHECK and a one-open-track-per-user index added by hand.

-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "tracking_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tracking_interval_seconds" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "field_tracks" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "batch_name" TEXT,
    "label" TEXT,
    "source" TEXT NOT NULL DEFAULT 'competition',
    "incubation_session_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "last_latitude" DECIMAL(10,7),
    "last_longitude" DECIMAL(10,7),
    "last_accuracy" DECIMAL(10,2),
    "last_captured_at" TIMESTAMP(3),
    "last_received_at" TIMESTAMP(3),
    "last_battery" INTEGER,
    "token_hash" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "token_revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_track_positions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy" DECIMAL(10,2) NOT NULL,
    "speed" DOUBLE PRECISION,
    "bearing" DOUBLE PRECISION,
    "battery" INTEGER,

    CONSTRAINT "field_track_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_tracks_token_hash_key" ON "field_tracks"("token_hash");

-- CreateIndex
CREATE INDEX "field_tracks_course_id_competition_id_ended_at_idx" ON "field_tracks"("course_id", "competition_id", "ended_at");

-- CreateIndex
CREATE INDEX "field_tracks_user_id_ended_at_idx" ON "field_tracks"("user_id", "ended_at");

-- CreateIndex
CREATE INDEX "field_tracks_incubation_session_id_idx" ON "field_tracks"("incubation_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_tracks_id_course_id_key" ON "field_tracks"("id", "course_id");

-- CreateIndex
CREATE INDEX "field_track_positions_course_id_captured_at_idx" ON "field_track_positions"("course_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "field_track_positions_track_id_captured_at_key" ON "field_track_positions"("track_id", "captured_at");

-- AddForeignKey
ALTER TABLE "field_tracks" ADD CONSTRAINT "field_tracks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tracks" ADD CONSTRAINT "field_tracks_competition_id_course_id_fkey" FOREIGN KEY ("competition_id", "course_id") REFERENCES "competitions"("id", "course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tracks" ADD CONSTRAINT "field_tracks_incubation_session_id_fkey" FOREIGN KEY ("incubation_session_id") REFERENCES "incubation_field_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_track_positions" ADD CONSTRAINT "field_track_positions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_track_positions" ADD CONSTRAINT "field_track_positions_track_id_course_id_fkey" FOREIGN KEY ("track_id", "course_id") REFERENCES "field_tracks"("id", "course_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Course isolation (same policy as the incubation tables).
ALTER TABLE "field_tracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_tracks" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "field_tracks" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "field_track_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_track_positions" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "field_track_positions" USING (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true)) WITH CHECK (current_setting('app.is_super_admin',true)='true' OR course_id=current_setting('app.current_course_id',true));

ALTER TABLE "field_track_positions" ADD CONSTRAINT field_track_coordinates CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND accuracy >= 0 AND (battery IS NULL OR battery BETWEEN 0 AND 100));
ALTER TABLE "field_tracks" ADD CONSTRAINT field_track_interval CHECK (interval_seconds BETWEEN 30 AND 3600 AND source IN ('competition','incubation'));
ALTER TABLE "competitions" ADD CONSTRAINT competition_tracking_interval CHECK (tracking_interval_seconds BETWEEN 30 AND 3600);

-- A user has at most one open track at a time.
CREATE UNIQUE INDEX field_tracks_one_open_per_user ON "field_tracks"("user_id") WHERE ended_at IS NULL;
