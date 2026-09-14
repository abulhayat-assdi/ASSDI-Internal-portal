-- M2 0004: Row Level Security matrix (deny-by-default).
--
-- Model (mirrors docs/rls-matrix.md):
--   student       → own rows + same active batch peers + own batch scopes; NO writes
--                   except through SECURITY DEFINER functions (0005).
--   teacher       → assigned courses/batches only (course and/or batch assignments).
--   admin         → own organization only (content + roll fixes; roll changes are
--                   audit-logged by the 0005 trigger regardless of writer).
--   super_admin   → FOR ALL on management tables; SELECT-only elsewhere, with all
--                   privileged writes going through service_role / functions.
--   audit_logs    → append-only: SELECT policies exist, NO insert/update/delete
--                   policies for API roles (trigger + functions write as owner).
--
-- Plain ENABLE ROW LEVEL SECURITY (never FORCE): table owners and service_role
-- must keep bypassing RLS so triggers/functions work. Client access always
-- flows through PostgREST as anon/authenticated.
--
-- RECURSION RULE: a policy body must reference only row columns, auth.uid(),
-- and SECURITY DEFINER helpers from 0003. Direct subqueries against other
-- RLS-protected tables create mutual policy evaluation
-- (courses ↔ teacher_assignments) and Postgres aborts with
-- "infinite recursion detected in policy".

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

ALTER TABLE typing_game.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.batch_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.feature_flags ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- organizations: tenant roots. Writes are super_admin-only (new tenants).
-- ---------------------------------------------------------------------------
CREATE POLICY organizations_super_admin_all ON typing_game.organizations
  FOR ALL TO authenticated
  USING (typing_game.is_super_admin()) WITH CHECK (typing_game.is_super_admin());

CREATE POLICY organizations_select_scoped ON typing_game.organizations
  FOR SELECT TO authenticated
  USING (
    typing_game.is_org_admin(id)
    OR id IN (SELECT typing_game.my_member_orgs())
    OR id IN (SELECT typing_game.my_teacher_orgs())
  );

-- ---------------------------------------------------------------------------
-- courses: org admin manages; members/teachers read their scope.
-- ---------------------------------------------------------------------------
CREATE POLICY courses_super_admin_all ON typing_game.courses
  FOR ALL TO authenticated
  USING (typing_game.is_super_admin()) WITH CHECK (typing_game.is_super_admin());

CREATE POLICY courses_write_org_admin ON typing_game.courses
  FOR ALL TO authenticated
  USING (typing_game.is_org_admin(organization_id))
  WITH CHECK (typing_game.is_org_admin(organization_id));

CREATE POLICY courses_select_scoped ON typing_game.courses
  FOR SELECT TO authenticated
  USING (
    typing_game.is_org_admin(organization_id)
    OR id IN (SELECT typing_game.my_member_courses())
    OR id IN (SELECT typing_game.my_teacher_courses())
  );

-- ---------------------------------------------------------------------------
-- batches: org admin manages; students see own batch; Batch B invisible.
-- ---------------------------------------------------------------------------
CREATE POLICY batches_super_admin_all ON typing_game.batches
  FOR ALL TO authenticated
  USING (typing_game.is_super_admin()) WITH CHECK (typing_game.is_super_admin());

CREATE POLICY batches_write_org_admin ON typing_game.batches
  FOR ALL TO authenticated
  -- USING reads the existing row; WITH CHECK resolves the incoming course.
  -- (batch_organization_id() cannot serve INSERT: the row does not exist yet.)
  USING (typing_game.is_org_admin(typing_game.batch_organization_id(batches.id)))
  WITH CHECK (typing_game.is_org_admin(
    typing_game.course_organization_id(batches.course_id)
  ));

CREATE POLICY batches_select_scoped ON typing_game.batches
  FOR SELECT TO authenticated
  USING (
    typing_game.is_batch_member(batches.id)
    OR typing_game.is_teacher_of_batch(batches.id)
    OR typing_game.is_org_admin(typing_game.batch_organization_id(batches.id))
  );

-- ---------------------------------------------------------------------------
-- profiles: own private data + staff-scoped reads. No API writes in M2
-- (creation via fn_register_with_batch; profile edits land in M6).
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_select_own ON typing_game.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY profiles_select_staff ON typing_game.profiles
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.user_id = profiles.id AND bm.is_active
        AND (
          typing_game.is_teacher_of_batch(bm.batch_id)
          OR typing_game.is_org_admin(typing_game.batch_organization_id(bm.batch_id))
        )
    )
  );

-- ---------------------------------------------------------------------------
-- user_roles: own roles readable; role grants are service_role/function-only.
-- ---------------------------------------------------------------------------
CREATE POLICY user_roles_select_own ON typing_game.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY user_roles_select_staff ON typing_game.user_roles
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND typing_game.is_org_admin(organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- teacher_assignments: teachers read their own scope; org admin manages.
-- ---------------------------------------------------------------------------
CREATE POLICY teacher_assignments_select_own ON typing_game.teacher_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY teacher_assignments_select_staff ON typing_game.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR typing_game.is_org_admin(typing_game.assignment_organization_id(
      teacher_assignments.course_id, teacher_assignments.batch_id
    ))
  );

CREATE POLICY teacher_assignments_write_org_admin ON typing_game.teacher_assignments
  FOR ALL TO authenticated
  USING (typing_game.is_org_admin(typing_game.assignment_organization_id(
    teacher_assignments.course_id, teacher_assignments.batch_id
  )))
  WITH CHECK (typing_game.is_org_admin(typing_game.assignment_organization_id(
    teacher_assignments.course_id, teacher_assignments.batch_id
  )));

-- ---------------------------------------------------------------------------
-- batch_members: peers see each other (privacy-safe columns only from M6);
-- students CANNOT insert/update/delete (roll immutability); org admin may
-- correct rolls — every change fires the audit trigger in 0005.
-- ---------------------------------------------------------------------------
CREATE POLICY batch_members_select_own ON typing_game.batch_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY batch_members_select_peers ON typing_game.batch_members
  FOR SELECT TO authenticated USING (typing_game.is_batch_member(batch_id));

CREATE POLICY batch_members_select_staff ON typing_game.batch_members
  FOR SELECT TO authenticated
  USING (
    typing_game.is_teacher_of_batch(batch_id)
    OR typing_game.is_org_admin(typing_game.batch_organization_id(batch_id))
  );

CREATE POLICY batch_members_update_org_admin ON typing_game.batch_members
  FOR UPDATE TO authenticated
  USING (typing_game.is_org_admin(typing_game.batch_organization_id(batch_id)))
  WITH CHECK (typing_game.is_org_admin(typing_game.batch_organization_id(batch_id)));

-- ---------------------------------------------------------------------------
-- audit_logs: append-only. No insert/update/delete policies for API roles.
-- Org admins read their own org's trail via trigger-written metadata.
-- ---------------------------------------------------------------------------
CREATE POLICY audit_logs_select_scoped ON typing_game.audit_logs
  FOR SELECT TO authenticated
  USING (
    typing_game.is_super_admin()
    OR (
      (metadata ->> 'organization_id') IS NOT NULL
      AND typing_game.is_org_admin((metadata ->> 'organization_id')::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- feature_flags (M1 table hardening): world-readable, service_role-only writes.
-- ---------------------------------------------------------------------------
CREATE POLICY feature_flags_select_public ON typing_game.feature_flags
  FOR SELECT TO anon, authenticated USING (true);
