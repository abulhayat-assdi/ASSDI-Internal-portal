-- M2 0002: identity + organizational core.
-- Chain: organizations → courses → batches → profiles / roles / memberships.
-- Plus append-only audit_logs. RLS policies land in 0004 (deny-by-default until then).
-- NOTE: profiles.id references auth.users(id) — provided by Supabase Auth in
-- production; the pgTAP container uses tests/bootstrap_auth_stub.sql (test-only).

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (spec: roles + skill tracks)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE typing_game.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typing_game.skill_track AS ENUM ('beginner', 'intermediate', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Organizations → Courses → Batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Deferred from 0001_feature_flags.sql: that migration runs before this table
-- exists, so feature_flags.org_id was created without an inline FK. Add it now.
DO $$ BEGIN
  ALTER TABLE typing_game.feature_flags
    ADD CONSTRAINT feature_flags_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES typing_game.organizations (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS typing_game.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES typing_game.organizations (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS courses_organization_id_idx ON typing_game.courses (organization_id);

CREATE TABLE IF NOT EXISTS typing_game.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES typing_game.courses (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  join_code text NOT NULL UNIQUE CHECK (char_length(join_code) BETWEEN 1 AND 64),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batches_course_id_idx ON typing_game.batches (course_id);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users; email is private — never batch-visible)
-- ---------------------------------------------------------------------------
-- No physical FK to public.users(id): ASM's own `users.id` column is `text`
-- (Prisma's default String id), while every id in this schema is `uuid` —
-- Postgres cannot create a FK across mismatched types. The relationship is
-- enforced by construction instead: the only writer of this table is
-- typing_game.fn_provision_from_asm() (0040_asm_identity_bridge.sql), which
-- always sets id = auth.uid(), itself parsed from the ASM session JWT's own
-- `sub` claim (= a real public.users.id, cast text -> uuid there).
CREATE TABLE IF NOT EXISTS typing_game.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Roles. Scope model (enforced by CHECK):
--   admin       → exactly one organization_id (org-scoped)
--   student/teacher/super_admin → organization_id IS NULL
--     (teachers are scoped via teacher_assignments, super_admin is global)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.user_roles (
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  role typing_game.user_role NOT NULL,
  organization_id uuid REFERENCES typing_game.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_scope_ck CHECK (
    (role = 'admin' AND organization_id IS NOT NULL)
    OR (role <> 'admin' AND organization_id IS NULL)
  ),
  UNIQUE (user_id, role, organization_id)
);
-- NULL organization_id defeats plain UNIQUE, so guard global roles separately.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_global_uniq
  ON typing_game.user_roles (user_id, role) WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON typing_game.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- Teacher scope: assignment to a course and/or a batch (at least one).
-- RLS uses EXISTS checks, so a hypothetical duplicate row grants no extra
-- privilege; the UNIQUE constraint is hygiene only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  course_id uuid REFERENCES typing_game.courses (id) ON DELETE CASCADE,
  batch_id uuid REFERENCES typing_game.batches (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_assignments_target_ck CHECK (
    course_id IS NOT NULL OR batch_id IS NOT NULL
  ),
  UNIQUE (user_id, course_id, batch_id)
);
CREATE INDEX IF NOT EXISTS teacher_assignments_user_id_idx
  ON typing_game.teacher_assignments (user_id);
CREATE INDEX IF NOT EXISTS teacher_assignments_batch_id_idx
  ON typing_game.teacher_assignments (batch_id);
CREATE INDEX IF NOT EXISTS teacher_assignments_course_id_idx
  ON typing_game.teacher_assignments (course_id);

-- ---------------------------------------------------------------------------
-- Batch membership. Spec roll rules:
--   unique inside a batch, reusable across batches, immutable to students
--   (RLS denies student UPDATE; admin changes fire the audit trigger in 0005).
-- "Exactly one active batch" (spec §4) is enforced by the partial unique
-- index; fn_register_with_batch rejects a second active enrolment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.batch_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES typing_game.batches (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  roll_number text NOT NULL CHECK (char_length(roll_number) BETWEEN 1 AND 32),
  skill_track typing_game.skill_track NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, user_id),
  UNIQUE (batch_id, roll_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS batch_members_one_active_uniq
  ON typing_game.batch_members (user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS batch_members_batch_id_idx ON typing_game.batch_members (batch_id);
CREATE INDEX IF NOT EXISTS batch_members_user_id_idx ON typing_game.batch_members (user_id);

-- ---------------------------------------------------------------------------
-- Audit log. Append-only: 0004 provides SELECT policies only — no
-- UPDATE/DELETE policies exist, so history cannot be rewritten via the API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES typing_game.profiles (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  entity text NOT NULL CHECK (char_length(entity) BETWEEN 1 AND 80),
  entity_id text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON typing_game.audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON typing_game.audit_logs (actor_user_id);
