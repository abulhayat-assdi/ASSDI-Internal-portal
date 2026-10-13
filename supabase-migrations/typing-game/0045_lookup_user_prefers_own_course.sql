-- 0045: fn_admin_lookup_user — prefer the caller's own course.
--
-- An ASM email is now unique per course rather than platform-wide (see
-- prisma/migrations/20261013120000_per_course_email_and_teacher_id): a
-- teacher shared between two courses has one public.users row, and so one
-- profile here, in each. The lookup used to return whichever profile matched
-- the email first, which could hand a course admin the same person's account
-- from the other course. It now returns the one in the caller's own course
-- when there is one, and only otherwise falls back to the oldest match.

CREATE OR REPLACE FUNCTION typing_game.fn_admin_lookup_user(p_email text)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_course_id text;
BEGIN
  IF NOT (
    typing_game.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM typing_game.user_roles r
      WHERE r.user_id = auth.uid() AND r.role = 'admin'
    )
  ) THEN
    RETURN;
  END IF;

  -- public.users carries ASM's course_isolation RLS policy, keyed off session
  -- GUCs PostgREST never sets (see 0040_asm_identity_bridge.sql). Bypassing it
  -- is safe here: it is read only for a course id, never returned.
  PERFORM set_config('app.is_super_admin', 'true', true);

  SELECT u.course_id INTO v_course_id FROM public.users u WHERE u.id = auth.uid()::text;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email
  FROM typing_game.profiles p
  LEFT JOIN public.users u ON u.id = p.id::text
  WHERE lower(p.email) = lower(btrim(p_email))
  ORDER BY (v_course_id IS NOT NULL AND u.course_id = v_course_id) DESC NULLS LAST, p.created_at
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_admin_lookup_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_admin_lookup_user(text) TO authenticated;
