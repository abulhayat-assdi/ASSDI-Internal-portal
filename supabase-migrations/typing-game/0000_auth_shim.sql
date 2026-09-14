-- 0039_auth_shim.sql
--
-- Self-hosted replacement for Supabase's built-in `auth` schema (GoTrue).
-- ASM has its own complete auth system (src/lib/auth.ts) — every session
-- cookie JWT is verified directly by PostgREST via PGRST_JWT_SECRET and
-- carries `sub` (= ASM users.id) and `pg_role: 'authenticated'` claims for
-- exactly this purpose (see signJWT). These functions expose the verified
-- claims the same way Supabase's own auth.uid()/auth.jwt() would, so the
-- ~150 ported functions/policies across 0001-0038 that call them keep
-- working unmodified. No GoTrue, no separate typing-game login, ever.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS typing_game;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;

-- Postgres role PostgREST has switched into for this request (mirrors
-- Supabase's auth.role()). Not to be confused with ASM's own app-level
-- `role` claim (student/teacher/admin/super_admin) — that stays under
-- auth.jwt()->>'role' if a function ever needs it, deliberately unrelated.
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'pg_role', 'anon');
$$;

GRANT EXECUTE ON FUNCTION auth.jwt() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.role() TO PUBLIC;

-- Roles PostgREST switches into per-request (PGRST_DB_ANON_ROLE=anon,
-- PGRST_JWT_ROLE_CLAIM_KEY='.pg_role' resolving to 'authenticated').
-- `authenticator` is PostgREST's own login role; its password is set
-- separately by scripts/typing-game-migrate.js from PGRST_AUTHENTICATOR_PASSWORD
-- (kept out of this file / git history on purpose).
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticator NOINHERIT LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

GRANT USAGE ON SCHEMA typing_game TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

-- Table/sequence/function-level grants for typing_game.* are carried by the
-- ported 0001-0038 files themselves (their own `GRANT ... TO anon,
-- authenticated` statements, rewritten to the typing_game schema by the same
-- rename pass that moved the tables there) plus RLS policies for row-level
-- restriction. Nothing further to grant here.
