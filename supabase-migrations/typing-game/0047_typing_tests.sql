-- Typing tests (1/3/5-minute, page tests, job-test practice). The server
-- picks the text and stores it on the session at start; at finish the Node
-- route re-grades the typed text against it (typing-exam gradeSnapshot,
-- bounded by the server clock) and saves the numbers here — the browser
-- never reports its own score.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE TABLE IF NOT EXISTS typing_game.typing_test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  test_id text NOT NULL CHECK (test_id ~ '^[a-z0-9-]{2,40}$'),
  language text NOT NULL CHECK (language IN ('en', 'bn')),
  text text NOT NULL CHECK (length(text) BETWEEN 10 AND 60000),
  duration_s int NOT NULL CHECK (duration_s BETWEEN 10 AND 3600),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'graded')),
  started_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  wpm numeric(6, 2),
  raw_wpm numeric(6, 2),
  accuracy numeric(5, 2),
  correct_chars int,
  total_chars int,
  time_ms int,
  finish_reason text
);
CREATE INDEX IF NOT EXISTS typing_test_sessions_user_idx
  ON typing_game.typing_test_sessions (user_id, started_at DESC);

ALTER TABLE typing_game.typing_test_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS typing_test_sessions_select_own ON typing_game.typing_test_sessions;
CREATE POLICY typing_test_sessions_select_own ON typing_game.typing_test_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS typing_test_sessions_select_staff ON typing_game.typing_test_sessions;
CREATE POLICY typing_test_sessions_select_staff ON typing_game.typing_test_sessions
  FOR SELECT TO authenticated
  USING (typing_game.is_super_admin() OR typing_game.is_org_admin_of_user(user_id));

GRANT SELECT ON typing_game.typing_test_sessions TO authenticated;

-- Opens a test for the calling student. Old never-finished sessions of the
-- same user are cleaned up so abandoned starts do not pile up.
CREATE OR REPLACE FUNCTION typing_game.fn_start_typing_test(
  p_test_id text, p_language text, p_text text, p_duration_s int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM typing_game.profiles WHERE id = v_me AND account_status = 'active') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  DELETE FROM typing_game.typing_test_sessions
  WHERE user_id = v_me AND status = 'started' AND started_at < now() - interval '1 day';
  INSERT INTO typing_game.typing_test_sessions (user_id, test_id, language, text, duration_s)
  VALUES (v_me, p_test_id, p_language, p_text, p_duration_s)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_start_typing_test(text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_start_typing_test(text, text, text, int) TO authenticated;

-- Stores the server-graded result once and awards 10 XP for each of the
-- first 10 tests a student finishes per day.
CREATE OR REPLACE FUNCTION typing_game.fn_finish_typing_test(
  p_session uuid,
  p_wpm numeric,
  p_raw_wpm numeric,
  p_accuracy numeric,
  p_correct_chars int,
  p_total_chars int,
  p_time_ms int,
  p_finish_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_today int;
  v_xp int := 0;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_wpm < 0 OR p_wpm > 600 OR p_raw_wpm < 0 OR p_raw_wpm > 900 OR p_accuracy < 0 OR p_accuracy > 100
     OR p_correct_chars < 0 OR p_total_chars < 0 OR p_time_ms < 0
     OR p_finish_reason NOT IN ('TIME_UP', 'COMPLETED', 'ABANDONED') THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
  END IF;

  UPDATE typing_game.typing_test_sessions SET
    status = 'graded', graded_at = now(), wpm = p_wpm, raw_wpm = p_raw_wpm, accuracy = p_accuracy,
    correct_chars = p_correct_chars, total_chars = p_total_chars, time_ms = p_time_ms,
    finish_reason = p_finish_reason
  WHERE id = p_session AND user_id = v_me AND status = 'started';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT count(*) INTO v_today FROM typing_game.typing_test_sessions
  WHERE user_id = v_me AND status = 'graded' AND graded_at >= date_trunc('day', now());
  IF v_today <= 10 AND p_correct_chars > 0 THEN
    v_xp := typing_game.fn_lesson_award_xp(
      v_me, 10, 'test:' || p_session::text, 'typing test',
      jsonb_build_object('session_id', p_session));
  END IF;
  RETURN jsonb_build_object('xp', v_xp);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_finish_typing_test(uuid, numeric, numeric, numeric, int, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_finish_typing_test(uuid, numeric, numeric, numeric, int, int, int, text) TO authenticated;
