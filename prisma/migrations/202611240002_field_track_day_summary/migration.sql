-- Saved walking summary per field track (distance, stops), so the day report keeps
-- working after the raw positions are purged at 90 days. Computed when a track ends.
-- Additive only.
ALTER TABLE "field_tracks"
  ADD COLUMN "distance_meters" INTEGER,
  ADD COLUMN "stop_count" INTEGER,
  ADD COLUMN "stop_minutes" INTEGER,
  ADD COLUMN "point_count" INTEGER,
  ADD COLUMN "summary_at" TIMESTAMP(3);

CREATE INDEX "field_tracks_course_id_competition_id_started_at_idx" ON "field_tracks"("course_id", "competition_id", "started_at");
