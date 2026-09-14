-- M2 0003: RLS helper predicates.
-- All helpers are SECURITY DEFINER with a fixed search_path so policies can
-- call them safely. EXECUTE is granted to `authenticated` only (revoked from
-- PUBLIC/anon). service_role bypasses RLS and never needs them.

-- ---------------------------------------------------------------------------
-- Role / scope predicates
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE OR REPLACE FUNCTION typing_game.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM typing_game.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION typing_game.batch_organization_id(p_batch_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT c.organization_id
  FROM typing_game.batches b
  JOIN typing_game.courses c ON c.id = b.course_id
  WHERE b.id = p_batch_id;
$$;

CREATE OR REPLACE FUNCTION typing_game.is_org_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT typing_game.is_super_admin() OR EXISTS (
    SELECT 1 FROM typing_game.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND organization_id = p_organization_id
  );
$$;

-- Is the caller an org admin (or super admin) of the organization that
-- p_user currently or formerly belonged to via any batch membership? Used to
-- replace bare fn_is_mission_admin() checks at call sites whose target is a
-- specific student, where "admin" must mean "admin of that student's own
-- organization," not "admin of any organization" (fn_is_mission_admin()
-- cannot distinguish the two — see 0016_missions.sql).
CREATE OR REPLACE FUNCTION typing_game.is_org_admin_of_user(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT typing_game.is_super_admin() OR EXISTS (
    SELECT 1 FROM typing_game.batch_members bm
    WHERE bm.user_id = p_user
      AND typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
  );
$$;

CREATE OR REPLACE FUNCTION typing_game.is_batch_member(p_batch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT typing_game.is_super_admin() OR EXISTS (
    SELECT 1 FROM typing_game.batch_members
    WHERE batch_id = p_batch_id AND user_id = auth.uid() AND is_active
  );
$$;

-- Teacher scope is assignment-based only (course and/or batch). Org admins get
-- their access via is_org_admin() in the policies, not through this predicate,
-- so the two scopes stay semantically separate.
CREATE OR REPLACE FUNCTION typing_game.is_teacher_of_batch(p_batch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT typing_game.is_super_admin() OR EXISTS (
    SELECT 1
    FROM typing_game.teacher_assignments ta
    JOIN typing_game.batches b ON b.id = p_batch_id
    WHERE ta.user_id = auth.uid()
      AND (ta.batch_id = b.id OR ta.course_id = b.course_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Set-returning scope helpers. Policies must NEVER query RLS-protected tables
-- directly: courses ↔ teacher_assignments policies would recurse into each
-- other ("infinite recursion detected in policy"). Every cross-table lookup
-- below runs as owner (SECURITY DEFINER bypasses RLS), so policies built on
-- these helpers cannot recurse. RULE: policies reference only row columns,
-- auth.uid(), and these helpers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.course_organization_id(p_course_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT organization_id FROM typing_game.courses WHERE id = p_course_id;
$$;

CREATE OR REPLACE FUNCTION typing_game.assignment_organization_id(
  p_course_id uuid, p_batch_id uuid
)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT c.organization_id
  FROM typing_game.courses c
  WHERE c.id = COALESCE(
    p_course_id,
    (SELECT b.course_id FROM typing_game.batches b WHERE b.id = p_batch_id)
  );
$$;

CREATE OR REPLACE FUNCTION typing_game.my_member_courses()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT b.course_id
  FROM typing_game.batch_members bm
  JOIN typing_game.batches b ON b.id = bm.batch_id
  WHERE bm.user_id = auth.uid() AND bm.is_active;
$$;

CREATE OR REPLACE FUNCTION typing_game.my_teacher_courses()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT ta.course_id
  FROM typing_game.teacher_assignments ta
  WHERE ta.user_id = auth.uid() AND ta.course_id IS NOT NULL
  UNION
  SELECT b.course_id
  FROM typing_game.teacher_assignments ta
  JOIN typing_game.batches b ON b.id = ta.batch_id
  WHERE ta.user_id = auth.uid() AND ta.batch_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION typing_game.my_member_orgs()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT c.organization_id
  FROM typing_game.batch_members bm
  JOIN typing_game.batches b ON b.id = bm.batch_id
  JOIN typing_game.courses c ON c.id = b.course_id
  WHERE bm.user_id = auth.uid() AND bm.is_active;
$$;

CREATE OR REPLACE FUNCTION typing_game.my_teacher_orgs()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT c.organization_id
  FROM typing_game.courses c
  WHERE c.id IN (SELECT typing_game.my_teacher_courses());
$$;

-- ---------------------------------------------------------------------------
-- Least privilege on the helpers themselves
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION typing_game.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.batch_organization_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.is_org_admin_of_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.is_batch_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.is_teacher_of_batch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.course_organization_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.assignment_organization_id(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.my_member_courses() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.my_teacher_courses() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.my_member_orgs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION typing_game.my_teacher_orgs() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION typing_game.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.batch_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.is_org_admin_of_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.is_batch_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.is_teacher_of_batch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.course_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.assignment_organization_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.my_member_courses() TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.my_teacher_courses() TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.my_member_orgs() TO authenticated;
GRANT EXECUTE ON FUNCTION typing_game.my_teacher_orgs() TO authenticated;
