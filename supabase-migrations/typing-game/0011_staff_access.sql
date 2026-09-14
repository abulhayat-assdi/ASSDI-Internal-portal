-- M7 0011: staff access layer (ADDITIVE — no M2 policy is modified).
--
-- 1. profiles.account_status (active/inactive/suspended) with a column guard:
--    the single UPDATE policy below can only ever change account_status —
--    the trigger rejects any write touching id/email/name/balances/level.
-- 2. Staff SELECT policies on attempt/result/streak/award/record tables so
--    assigned teachers and org admins can run their consoles. Students see
--    no change (own-rows-only still).
-- 3. Generic audit trigger on courses/batches/assignments/roles
--    (batch_members already has its roll-specific trigger from 0005).
-- 4. feature_flags super_admin management (reads were already public).
-- 5. fn_grant_role: the only API path for role grants (audited).

-- ---------------------------------------------------------------------------
-- 1. Account states.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

ALTER TABLE typing_game.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'inactive', 'suspended'));

CREATE POLICY profiles_update_status ON typing_game.profiles
  FOR UPDATE TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = profiles.id
        AND typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
    )
  )
  WITH CHECK (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = profiles.id
        AND typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
    )
  );

-- Column guard: only account_status may change through the API.
-- Owner/service_role paths (progression function, ops) bypass: they run as
-- the table owner, never as anon/authenticated. API requests always run as
-- anon/authenticated through PostgREST, so the guard binds exactly them.
CREATE OR REPLACE FUNCTION typing_game.trg_profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
      OR NEW.xp_total IS DISTINCT FROM OLD.xp_total
      OR NEW.coin_balance IS DISTINCT FROM OLD.coin_balance
      OR NEW.current_level IS DISTINCT FROM OLD.current_level
      OR NEW.timezone IS DISTINCT FROM OLD.timezone
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'PROTECTED_COLUMNS';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard ON typing_game.profiles;
CREATE TRIGGER trg_profiles_guard
  BEFORE UPDATE ON typing_game.profiles
  FOR EACH ROW EXECUTE FUNCTION typing_game.trg_profiles_guard();

-- ---------------------------------------------------------------------------
-- 2. Staff reads (assigned teachers + org admins; super_admin via helpers).
-- ---------------------------------------------------------------------------
CREATE POLICY attempts_select_staff ON typing_game.game_attempts
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = game_attempts.user_id AND bm.is_active
        AND (
          typing_game.is_teacher_of_batch(bm.batch_id)
          OR typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
        )
    )
  );

CREATE POLICY results_select_staff ON typing_game.attempt_results
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.game_attempts a
      JOIN typing_game.batch_members bm
        ON bm.user_id = a.user_id AND bm.is_active
      WHERE a.id = attempt_results.attempt_id
        AND (
          typing_game.is_teacher_of_batch(bm.batch_id)
          OR typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
        )
    )
  );

CREATE POLICY streaks_select_staff ON typing_game.streaks
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = streaks.user_id AND bm.is_active
        AND (
          typing_game.is_teacher_of_batch(bm.batch_id)
          OR typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
        )
    )
  );

CREATE POLICY badge_awards_select_staff ON typing_game.badge_awards
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = badge_awards.user_id AND bm.is_active
        AND (
          typing_game.is_teacher_of_batch(bm.batch_id)
          OR typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
        )
    )
  );

CREATE POLICY personal_records_select_staff ON typing_game.personal_records
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = personal_records.user_id AND bm.is_active
        AND (
          typing_game.is_teacher_of_batch(bm.batch_id)
          OR typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Generic audit trigger (owner-written; API roles have no audit writes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.trg_audit_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_id text;
  v_org uuid := NULL;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
BEGIN
  v_id := COALESCE(v_new ->> 'id', v_old ->> 'id', '');

  -- Resolve the owning organization so org admins can read their own trail
  -- (audit_logs RLS keys off metadata.organization_id).
  IF TG_TABLE_NAME = 'courses' THEN
    v_org := COALESCE((v_new ->> 'organization_id'), (v_old ->> 'organization_id'))::uuid;
  ELSIF TG_TABLE_NAME = 'batches' THEN
    SELECT c.organization_id INTO v_org FROM typing_game.courses c
    WHERE c.id = COALESCE((v_new ->> 'course_id'), (v_old ->> 'course_id'))::uuid;
  ELSIF TG_TABLE_NAME = 'teacher_assignments' THEN
    SELECT c.organization_id INTO v_org FROM typing_game.courses c
    WHERE c.id = COALESCE(
      NULLIF(v_new ->> 'course_id', '')::uuid,
      NULLIF(v_old ->> 'course_id', '')::uuid,
      (SELECT b.course_id FROM typing_game.batches b
       WHERE b.id = COALESCE(
         NULLIF(v_new ->> 'batch_id', '')::uuid,
         NULLIF(v_old ->> 'batch_id', '')::uuid))
    );
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    v_org := COALESCE(
      NULLIF(v_new ->> 'organization_id', ''),
      NULLIF(v_old ->> 'organization_id', ''))::uuid;
  END IF;

  INSERT INTO typing_game.audit_logs (actor_user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    TG_ARGV[0] || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old', v_old,
      'new', v_new,
      'organization_id', v_org
    ))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_write_courses ON typing_game.courses;
CREATE TRIGGER trg_audit_write_courses
  AFTER INSERT OR UPDATE OR DELETE ON typing_game.courses
  FOR EACH ROW EXECUTE FUNCTION typing_game.trg_audit_write('course');

DROP TRIGGER IF EXISTS trg_audit_write_batches ON typing_game.batches;
CREATE TRIGGER trg_audit_write_batches
  AFTER INSERT OR UPDATE OR DELETE ON typing_game.batches
  FOR EACH ROW EXECUTE FUNCTION typing_game.trg_audit_write('batch');

DROP TRIGGER IF EXISTS trg_audit_write_assignments ON typing_game.teacher_assignments;
CREATE TRIGGER trg_audit_write_assignments
  AFTER INSERT OR UPDATE OR DELETE ON typing_game.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION typing_game.trg_audit_write('teacher_assignment');

DROP TRIGGER IF EXISTS trg_audit_write_roles ON typing_game.user_roles;
CREATE TRIGGER trg_audit_write_roles
  AFTER INSERT OR UPDATE OR DELETE ON typing_game.user_roles
  FOR EACH ROW EXECUTE FUNCTION typing_game.trg_audit_write('user_role');

-- ---------------------------------------------------------------------------
-- 4. Feature-flag management for super admins (reads stay public).
-- ---------------------------------------------------------------------------
CREATE POLICY feature_flags_super_admin_all ON typing_game.feature_flags
  FOR ALL TO authenticated
  USING (typing_game.is_super_admin())
  WITH CHECK (typing_game.is_super_admin());

-- Org admins may write only their own org-scoped override rows (org_id IS NOT
-- NULL and matches an org they admin) — never the platform-wide (org_id IS
-- NULL) default rows, which remain super_admin-only via the policy above.
CREATE POLICY feature_flags_org_admin_all ON typing_game.feature_flags
  FOR ALL TO authenticated
  USING (org_id IS NOT NULL AND typing_game.is_org_admin(org_id))
  WITH CHECK (org_id IS NOT NULL AND typing_game.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- 5. Role grants: super_admin anything; org admins teacher/student only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_grant_role(
  p_user uuid,
  p_role typing_game.user_role,
  p_organization uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_is_super boolean := typing_game.is_super_admin();
  v_is_admin boolean := EXISTS (
    SELECT 1 FROM typing_game.user_roles
    WHERE user_id = v_me AND role = 'admin'
  );
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM typing_game.profiles WHERE id = p_user) THEN
    RAISE EXCEPTION 'UNKNOWN_USER';
  END IF;
  -- Scope rule mirrors user_roles_scope_ck.
  IF p_role = 'admin' AND p_organization IS NULL THEN
    RAISE EXCEPTION 'ORG_REQUIRED';
  END IF;
  IF p_role <> 'admin' AND p_organization IS NOT NULL THEN
    RAISE EXCEPTION 'ORG_FORBIDDEN';
  END IF;
  IF NOT v_is_super THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    -- Org admins may only move users between the two non-admin global roles.
    IF p_role NOT IN ('teacher', 'student') THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  INSERT INTO typing_game.user_roles (user_id, role, organization_id)
  VALUES (p_user, p_role, p_organization)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION
  typing_game.fn_grant_role(uuid, typing_game.user_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  typing_game.fn_grant_role(uuid, typing_game.user_role, uuid) TO authenticated;
