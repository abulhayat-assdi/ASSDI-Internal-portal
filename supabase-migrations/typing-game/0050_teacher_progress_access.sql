-- Teachers can read the lesson progress, typing-test results and daily
-- typing time of students in batches they teach (read-only; students'
-- own and admin policies from 0046/0047/0049 are unchanged).

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE OR REPLACE FUNCTION typing_game.fn_teaches_student(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM typing_game.batch_members bm
    WHERE bm.user_id = p_user AND typing_game.is_teacher_of_batch(bm.batch_id)
  );
$$;
REVOKE ALL ON FUNCTION typing_game.fn_teaches_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_teaches_student(uuid) TO authenticated;

DROP POLICY IF EXISTS lesson_progress_select_teacher ON typing_game.lesson_progress;
CREATE POLICY lesson_progress_select_teacher ON typing_game.lesson_progress
  FOR SELECT TO authenticated USING (typing_game.fn_teaches_student(user_id));

DROP POLICY IF EXISTS typing_test_sessions_select_teacher ON typing_game.typing_test_sessions;
CREATE POLICY typing_test_sessions_select_teacher ON typing_game.typing_test_sessions
  FOR SELECT TO authenticated USING (typing_game.fn_teaches_student(user_id));

DROP POLICY IF EXISTS daily_activity_select_teacher ON typing_game.daily_activity;
CREATE POLICY daily_activity_select_teacher ON typing_game.daily_activity
  FOR SELECT TO authenticated USING (typing_game.fn_teaches_student(user_id));
