-- 0041_staff_provisioning_and_flags.sql
--
-- Two additions to close gaps found while building the rollout-control UI:
--
-- 1. fn_provision_staff_from_asm() — the teacher/admin/super_admin
--    counterpart to fn_provision_from_asm() (0040, student-only). Until now,
--    a teacher/admin/super_admin ASM user had NO typing_game.profiles/
--    user_roles/teacher_assignments row unless someone inserted it by hand
--    (which is what testing did) — every staff console page would 403.
--
-- 2. fn_set_org_flag() — lets a Course's own admin toggle a flag scoped to
--    their organization only (never the global/NULL-org row), using the
--    already-existing typing_game.is_org_admin() check and the
--    feature_flags_key_org_uniq partial index from 0001/Track B's rewrite.
--    PostgREST's built-in upsert doesn't support a partial-index conflict
--    target, so this goes through a SECURITY DEFINER function instead of a
--    raw .upsert() call from the app.
--
-- Also seeds three new global flag keys (MISSIONS_ENABLED, SHOP_ENABLED,
-- TOURNAMENTS_ENABLED) so the admin flags UI has something to show for
-- these three systems, which previously had no on/off switch at all.
--
-- NOTE (scope, discussed with the user): none of PHASE_2_ADAPTIVE,
-- PHASE_3_CLAN_WARS, PHASE_3_SEASONS, or these three new keys are actually
-- READ anywhere yet — no SQL function or route checks them, and the student
-- nav doesn't hide sections by flag either (only the rewarded-ads flags in
-- 0035/0036 have real enforcement). This migration adds the *control* layer
-- only; wiring real enforcement into each system's functions/nav is a
-- separate, deliberately deferred follow-up.

INSERT INTO typing_game.feature_flags (key, enabled, description) VALUES
  ('MISSIONS_ENABLED', true, 'Daily/weekly missions'),
  ('SHOP_ENABLED', true, 'Coin shop and inventory'),
  ('TOURNAMENTS_ENABLED', false, 'Bracket tournaments')
ON CONFLICT (key) WHERE org_id IS NULL DO NOTHING;

-- ---------------------------------------------------------------------------
-- Staff provisioning (teacher / admin / super_admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_provision_staff_from_asm()
RETURNS typing_game.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_org_id uuid;
  v_course_id uuid;
  v_profile typing_game.profiles;
BEGIN
  -- See 0040's fn_provision_from_asm for why this bypass is needed and safe:
  -- public.users/courses carry ASM's own FORCE ROW LEVEL SECURITY, which
  -- PostgREST's connection never satisfies on its own.
  PERFORM set_config('app.is_super_admin', 'true', true);

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid()::text;
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'fn_provision_staff_from_asm: no ASM user for auth.uid()';
  END IF;
  IF v_user.role NOT IN ('teacher', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'fn_provision_staff_from_asm: staff-only (role=%)', v_user.role;
  END IF;

  INSERT INTO typing_game.profiles (id, email, full_name)
  VALUES (auth.uid(), v_user.email, v_user.display_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  IF v_user.role = 'super_admin' THEN
    INSERT INTO typing_game.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'super_admin', NULL)
    ON CONFLICT (user_id, role) WHERE organization_id IS NULL DO NOTHING;

  ELSIF v_user.role = 'admin' THEN
    IF v_user.course_id IS NULL THEN
      RAISE EXCEPTION 'fn_provision_staff_from_asm: admin % has no course_id', v_user.id;
    END IF;

    INSERT INTO typing_game.organizations (id, name, slug, asm_course_id)
    SELECT gen_random_uuid(), c.name, c.slug, c.id FROM public.courses c WHERE c.id = v_user.course_id
    ON CONFLICT (asm_course_id) DO NOTHING;
    SELECT id INTO v_org_id FROM typing_game.organizations WHERE asm_course_id = v_user.course_id;

    INSERT INTO typing_game.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'admin', v_org_id)
    ON CONFLICT (user_id, role, organization_id) DO NOTHING;

  ELSIF v_user.role = 'teacher' THEN
    IF v_user.course_id IS NULL THEN
      RAISE EXCEPTION 'fn_provision_staff_from_asm: teacher % has no course_id', v_user.id;
    END IF;

    INSERT INTO typing_game.organizations (id, name, slug, asm_course_id)
    SELECT gen_random_uuid(), c.name, c.slug, c.id FROM public.courses c WHERE c.id = v_user.course_id
    ON CONFLICT (asm_course_id) DO NOTHING;

    INSERT INTO typing_game.courses (id, organization_id, title, slug, asm_course_id)
    SELECT gen_random_uuid(), o.id, 'Typing Adventure', 'typing-adventure', o.asm_course_id
    FROM typing_game.organizations o WHERE o.asm_course_id = v_user.course_id
    ON CONFLICT (asm_course_id) DO NOTHING;
    SELECT id INTO v_course_id FROM typing_game.courses WHERE asm_course_id = v_user.course_id;

    INSERT INTO typing_game.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'teacher', NULL)
    ON CONFLICT (user_id, role) WHERE organization_id IS NULL DO NOTHING;

    -- teacher_assignments' UNIQUE (user_id, course_id, batch_id) doesn't
    -- de-dupe a repeated NULL batch_id (Postgres treats NULL <> NULL in
    -- unique constraints) — guard with an explicit existence check instead
    -- of ON CONFLICT.
    INSERT INTO typing_game.teacher_assignments (user_id, course_id)
    SELECT auth.uid(), v_course_id
    WHERE NOT EXISTS (
      SELECT 1 FROM typing_game.teacher_assignments
      WHERE user_id = auth.uid() AND course_id = v_course_id AND batch_id IS NULL
    );
  END IF;

  SELECT * INTO v_profile FROM typing_game.profiles WHERE id = auth.uid();
  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_provision_staff_from_asm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_provision_staff_from_asm() TO authenticated;

-- ---------------------------------------------------------------------------
-- Org-scoped flag writes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_set_org_flag(
  p_key text,
  p_org_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
BEGIN
  IF p_org_id IS NULL OR NOT typing_game.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  INSERT INTO typing_game.feature_flags (key, org_id, enabled)
  VALUES (p_key, p_org_id, p_enabled)
  ON CONFLICT (key, org_id) WHERE org_id IS NOT NULL
  DO UPDATE SET enabled = EXCLUDED.enabled;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_set_org_flag(text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_set_org_flag(text, uuid, boolean) TO authenticated;
