-- 0040_asm_identity_bridge.sql
--
-- Maps ASM's own tenant/roster tables (public.courses, public.batches,
-- public.batch_students, public.users — see prisma/schema.prisma) onto the
-- typing-game's organizations -> courses(curriculum) -> batches ->
-- batch_members chain, replacing its original join-code/self-registration
-- flow (fn_register_with_batch, 0005) entirely. That function is left
-- defined-but-unused rather than dropped, since it has its own pgTAP
-- coverage upstream.
--
-- One-time backfill of organizations/courses/batches happens inline below
-- (cheap, idempotent). Per-student profile/role/membership rows are
-- provisioned lazily by fn_provision_from_asm(), called once from
-- src/app/api/typing-game/provision/route.ts the first time a student opens
-- the Typing Game section.

ALTER TABLE typing_game.organizations ADD COLUMN IF NOT EXISTS asm_course_id text UNIQUE;
ALTER TABLE typing_game.courses ADD COLUMN IF NOT EXISTS asm_course_id text UNIQUE;
ALTER TABLE typing_game.batches ADD COLUMN IF NOT EXISTS asm_batch_id text UNIQUE;

-- ---------------------------------------------------------------------------
-- One-time backfill: one organization + one "Typing Adventure" curriculum
-- row per existing ASM Course, one batch row per existing ASM Batch.
-- Idempotent — scripts/typing-game-migrate.js only ever runs this file once
-- per deploy anyway, but ON CONFLICT makes re-runs harmless too.
--
-- Unlike fn_provision_from_asm() below, these are plain top-level statements
-- (no SECURITY DEFINER function wrapping them), run by the migration script
-- connected as whatever DB user DATABASE_URL names (app_user in dev — not a
-- real Postgres superuser). public.courses/batches carry ASM's own
-- course_isolation RLS policy with FORCE ROW LEVEL SECURITY, which applies
-- to that user too, so without this the SELECTs below silently return zero
-- rows (RLS fails closed) and the backfill does nothing. LOCAL to this
-- transaction only (each file runs in its own transaction per
-- scripts/typing-game-migrate.js), never touches Prisma's own connections.
SELECT set_config('app.is_super_admin', 'true', true);
-- ---------------------------------------------------------------------------
INSERT INTO typing_game.organizations (id, name, slug, asm_course_id)
SELECT gen_random_uuid(), c.name, c.slug, c.id
FROM public.courses c
ON CONFLICT (asm_course_id) DO NOTHING;

INSERT INTO typing_game.courses (id, organization_id, title, slug, asm_course_id)
SELECT gen_random_uuid(), o.id, 'Typing Adventure', 'typing-adventure', o.asm_course_id
FROM typing_game.organizations o
ON CONFLICT (asm_course_id) DO NOTHING;

INSERT INTO typing_game.batches (id, course_id, name, join_code, asm_batch_id)
SELECT gen_random_uuid(), tc.id, b.name, encode(gen_random_bytes(8), 'hex'), b.id
FROM public.batches b
JOIN typing_game.courses tc ON tc.asm_course_id = b.course_id
ON CONFLICT (asm_batch_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Lazy per-student provisioning. Runs as the calling student (SECURITY
-- DEFINER so it can write profiles/user_roles/batch_members, which students
-- otherwise cannot insert into directly), but every lookup is keyed off
-- auth.uid() itself — a student can only ever provision their own row.
-- Teacher/admin provisioning is out of scope for this phase (no
-- teacher-facing typing-game screen needs it yet).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_provision_from_asm()
RETURNS typing_game.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_roster_name text;
  v_roster_photo text;
  v_org_id uuid;
  v_course_id uuid;
  v_batch_id uuid;
  v_profile typing_game.profiles;
BEGIN
  -- public.users/courses/batches/batch_students all carry ASM's own
  -- course_isolation RLS policy with FORCE ROW LEVEL SECURITY (see
  -- prisma/migrations/20260912171615_enable_row_level_security) keyed off
  -- app.current_course_id/app.is_super_admin — session GUCs that only
  -- Prisma's withCourseContext() ever sets. PostgREST's connection never
  -- sets them, so without this, every read below would silently return zero
  -- rows regardless of auth.uid(). Bypassing RLS here is safe: this SECURITY
  -- DEFINER function's own logic (below) already restricts every lookup to
  -- auth.uid()'s own row and derived course/batch — never a caller-supplied
  -- course id — mirroring how src/lib/course.ts's getCourseBySlug() does the
  -- same is_super_admin-context bypass before a course id is even known.
  PERFORM set_config('app.is_super_admin', 'true', true);

  -- public.users.id is `text` (Prisma's default String id); auth.uid()
  -- returns `uuid` (parsed from the JWT `sub` claim) — cast to compare.
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid()::text;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'fn_provision_from_asm: no ASM user for auth.uid()';
  END IF;

  IF v_user.role <> 'student' THEN
    RAISE EXCEPTION 'fn_provision_from_asm: student-only in this phase (role=%)', v_user.role;
  END IF;

  IF v_user.course_id IS NULL OR v_user.student_batch_name IS NULL OR v_user.student_roll IS NULL THEN
    RAISE EXCEPTION 'fn_provision_from_asm: ASM user % is missing course/batch/roll', v_user.id;
  END IF;

  -- Create the profile FIRST, before touching organizations/courses/batches.
  -- Several tables in 0002-0038 carry an audit trigger (trg_audit_write)
  -- whose INSERT into typing_game.audit_logs has a NOT-NULL-enforced-by-FK
  -- actor_user_id -> profiles(id) — so any lazily-created organizations/
  -- courses/batches row below (first student of a brand-new academy) would
  -- fail that FK if profiles didn't already have this student's row yet.
  -- Roster lookup doesn't depend on org/course/batch existing either, so it
  -- moves up here too.
  SELECT name, photo INTO v_roster_name, v_roster_photo
  FROM public.batch_students
  WHERE course_id = v_user.course_id
    AND batch_name = v_user.student_batch_name
    AND roll = v_user.student_roll;

  -- typing_game.* ids are all `uuid` — use auth.uid() directly here rather
  -- than v_user.id (`text`), avoiding another cross-type cast.
  INSERT INTO typing_game.profiles (id, email, full_name, avatar_url)
  VALUES (auth.uid(), v_user.email, COALESCE(v_roster_name, v_user.display_name), v_roster_photo)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url
  RETURNING * INTO v_profile;

  -- Org/curriculum/batch should already exist from the backfill above; create
  -- on the fly for a Course/Batch added after this migration ran.
  INSERT INTO typing_game.organizations (id, name, slug, asm_course_id)
  SELECT gen_random_uuid(), c.name, c.slug, c.id FROM public.courses c WHERE c.id = v_user.course_id
  ON CONFLICT (asm_course_id) DO NOTHING;
  SELECT id INTO v_org_id FROM typing_game.organizations WHERE asm_course_id = v_user.course_id;

  INSERT INTO typing_game.courses (id, organization_id, title, slug, asm_course_id)
  VALUES (gen_random_uuid(), v_org_id, 'Typing Adventure', 'typing-adventure', v_user.course_id)
  ON CONFLICT (asm_course_id) DO NOTHING;
  SELECT id INTO v_course_id FROM typing_game.courses WHERE asm_course_id = v_user.course_id;

  INSERT INTO typing_game.batches (id, course_id, name, join_code, asm_batch_id)
  SELECT gen_random_uuid(), v_course_id, b.name, encode(gen_random_bytes(8), 'hex'), b.id
  FROM public.batches b
  WHERE b.course_id = v_user.course_id AND b.name = v_user.student_batch_name
  ON CONFLICT (asm_batch_id) DO NOTHING;
  SELECT id INTO v_batch_id FROM typing_game.batches
    WHERE course_id = v_course_id AND name = v_user.student_batch_name;

  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'fn_provision_from_asm: no ASM batch "%" in course %', v_user.student_batch_name, v_user.course_id;
  END IF;

  INSERT INTO typing_game.user_roles (user_id, role, organization_id)
  VALUES (auth.uid(), 'student', NULL)
  ON CONFLICT (user_id, role) WHERE organization_id IS NULL DO NOTHING;

  -- NOTE: does not handle a student being transferred to a different ASM
  -- batch after first provisioning (would need to deactivate the old
  -- batch_members row first, since batch_members_one_active_uniq allows only
  -- one active batch per user) — out of scope until a transfer flow exists.
  INSERT INTO typing_game.batch_members (id, batch_id, user_id, roll_number, skill_track, is_active)
  VALUES (gen_random_uuid(), v_batch_id, auth.uid(), v_user.student_roll, 'beginner', true)
  ON CONFLICT (batch_id, user_id) DO NOTHING;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_provision_from_asm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_provision_from_asm() TO authenticated;
