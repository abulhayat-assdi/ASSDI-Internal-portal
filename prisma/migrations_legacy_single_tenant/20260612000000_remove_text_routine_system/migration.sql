-- Remove the old text/grid based class-routine system.
-- The routine feature is now a single uploaded image per batch, stored in the
-- existing "routines" table (model Routine). These two tables are no longer used.

DROP TABLE IF EXISTS "batch_routine_entries";
DROP TABLE IF EXISTS "routine_configs";
