-- M7 0012: admin operations support (ADDITIVE).
-- courses.is_active, batch dates, super_admin game toggle, email lookup for
-- assignment flows, and role revocation. Covered by the generic audit
-- triggers from 0011 (courses/batches/assignments/roles all fire).

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

ALTER TABLE typing_game.courses
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE typing_game.batches
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Emergency content switch (super admins only; admins manage their own
-- courses/batches, the global game catalog stays super-admin gated).
CREATE POLICY games_write_super_admin ON typing_game.games
  FOR ALL TO authenticated
  USING (typing_game.is_super_admin())
  WITH CHECK (typing_game.is_super_admin());

-- Email → identity lookup for assignment flows. Minimal fields, exact match
-- only (no enumeration): admins and super admins can resolve anyone (they
-- need it to assign teachers); everyone else gets zero rows.
CREATE OR REPLACE FUNCTION typing_game.fn_admin_lookup_user(p_email text)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT p.id, p.full_name, p.email
  FROM typing_game.profiles p
  WHERE lower(p.email) = lower(btrim(p_email))
    AND (
      typing_game.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM typing_game.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_admin_lookup_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_admin_lookup_user(text) TO authenticated;

-- Role revocation: same privilege ladder as fn_grant_role.
CREATE OR REPLACE FUNCTION typing_game.fn_revoke_role(
  p_user uuid,
  p_role typing_game.user_role
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
  IF NOT v_is_super THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    IF p_role NOT IN ('teacher', 'student') THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  DELETE FROM typing_game.user_roles
  WHERE user_id = p_user
    AND role = p_role
    AND (p_role <> 'admin' OR organization_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION
  typing_game.fn_revoke_role(uuid, typing_game.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  typing_game.fn_revoke_role(uuid, typing_game.user_role) TO authenticated;
