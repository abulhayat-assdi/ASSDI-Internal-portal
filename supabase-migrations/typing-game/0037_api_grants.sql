-- M18 0037: least-privilege API grants for the authenticated role.
--
-- Finding: every migration defined RLS policies but none granted table
-- privileges, so in production ALL direct PostgREST reads (and the few
-- direct staff writes) fail with "permission denied". RLS policies
-- remain the enforcement; these grants only enable the mechanism.
--
-- Rule: SELECT everywhere (RLS restricts rows); writes ONLY where the
-- app writes directly today (staff course/batch/assignment management
-- plus the two column-guarded UPDATE policies). Every other mutation
-- goes through SECURITY DEFINER fns (which run as owner and need no
-- grants). Future tables get SELECT automatically; future direct
-- writes must add explicit grants in their own migration.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

-- NOTE: rewritten from the source's bare `SCHEMA public` to `SCHEMA
-- typing_game` — in the source project `public` WAS this project's own
-- schema, but here `public` is ASM Portal's real production schema
-- (users, batch_students, etc.). Granting the typing-game's `authenticated`/
-- `anon` Postgres roles anything on ASM's actual `public` schema would leak
-- ASM's production data (including personal student info) to every
-- typing-game session — the identifier-based rename pass that moved
-- `public.<table>` → `typing_game.<table>` everywhere else in these 38 files
-- doesn't touch a bare schema-name reference like this, so it needed a
-- manual fix here specifically.
GRANT USAGE ON SCHEMA typing_game TO authenticated;
GRANT USAGE ON SCHEMA typing_game TO anon;

GRANT SELECT ON ALL TABLES IN SCHEMA typing_game TO authenticated;

GRANT INSERT, UPDATE, DELETE ON typing_game.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON typing_game.batches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON typing_game.teacher_assignments TO authenticated;
GRANT UPDATE ON typing_game.batch_members TO authenticated;
GRANT UPDATE ON typing_game.profiles TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA typing_game TO authenticated;

-- Future tables: SELECT flows automatically; direct writes stay
-- deny-by-default until their migration grants them explicitly.
-- `FOR ROLE postgres` (the source's hardcoded value, since Supabase's own
-- migration runner always connects as `postgres`) is dropped in favor of the
-- default (the role actually running this migration) — ASM's migration
-- runner (scripts/typing-game-migrate.js) may connect as any DB user
-- (`postgres` in the default docker-compose setup, something else in a
-- custom one), and that's exactly the role whose future-object defaults
-- need to be set here.
ALTER DEFAULT PRIVILEGES IN SCHEMA typing_game
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA typing_game
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
