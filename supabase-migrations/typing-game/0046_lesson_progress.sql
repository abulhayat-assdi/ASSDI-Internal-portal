-- Level-wise typing lessons (typing.com style). Lesson CONTENT lives in code
-- (src/lib/typing-game/curriculum); this stores each student's progress per
-- lesson id. Order rules (which lesson is open) are checked in the Node
-- route before these functions run; the functions guard ranges, ownership
-- and idempotent XP.
--
-- Pass rule: finishing a lesson completes it — there is no speed minimum.
-- Skipped lessons open the next one but earn nothing.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE TABLE IF NOT EXISTS typing_game.lesson_progress (
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  lesson_id text NOT NULL CHECK (lesson_id ~ '^[a-z]{2}-[0-9]+-[0-9]{2,3}$'),
  level_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'skipped')),
  stars smallint NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  best_wpm numeric(6, 2) NOT NULL DEFAULT 0,
  best_accuracy numeric(5, 2) NOT NULL DEFAULT 0,
  best_time_ms int,
  last_time_ms int,
  total_time_ms bigint NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS lesson_progress_level_idx
  ON typing_game.lesson_progress (level_id, user_id);

ALTER TABLE typing_game.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_progress_select_own ON typing_game.lesson_progress;
CREATE POLICY lesson_progress_select_own ON typing_game.lesson_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS lesson_progress_select_staff ON typing_game.lesson_progress;
CREATE POLICY lesson_progress_select_staff ON typing_game.lesson_progress
  FOR SELECT TO authenticated
  USING (typing_game.is_super_admin() OR typing_game.is_org_admin_of_user(user_id));

GRANT SELECT ON typing_game.lesson_progress TO authenticated;
-- No direct writes: only the SECURITY DEFINER functions below.

-- Adds XP once per (user, reference); returns the amount actually added.
CREATE OR REPLACE FUNCTION typing_game.fn_lesson_award_xp(
  p_user uuid, p_amount int, p_ref text, p_reason text, p_meta jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_total int;
BEGIN
  IF p_amount <= 0 THEN RETURN 0; END IF;
  SELECT xp_total INTO v_total FROM typing_game.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  INSERT INTO typing_game.xp_ledger
    (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
  VALUES (p_user, p_amount, 'lesson', 'lesson', p_ref, p_reason, p_meta, v_total + p_amount)
  ON CONFLICT (user_id, source, reference_id) DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  UPDATE typing_game.profiles
  SET xp_total = v_total + p_amount,
      current_level = COALESCE(
        (SELECT max(level) FROM typing_game.levels WHERE required_xp <= v_total + p_amount),
        current_level)
  WHERE id = p_user;
  RETURN p_amount;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_lesson_award_xp(uuid, int, text, text, jsonb) FROM PUBLIC;

-- Saves a finished lesson for the calling student and awards XP:
-- 20 on the first completion, plus 10 for each star level reached the first time.
CREATE OR REPLACE FUNCTION typing_game.fn_record_lesson_result(
  p_lesson_id text,
  p_level_id text,
  p_wpm numeric,
  p_accuracy numeric,
  p_stars int,
  p_time_ms int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_prev typing_game.lesson_progress%ROWTYPE;
  v_had boolean;
  v_xp int := 0;
  v_first boolean;
  v_star int;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM typing_game.profiles WHERE id = v_me AND account_status = 'active') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_lesson_id !~ '^[a-z]{2}-[0-9]+-[0-9]{2,3}$' OR p_level_id !~ '^[a-z]{2}-[0-9]+$'
     OR p_wpm < 0 OR p_wpm > 600 OR p_accuracy < 0 OR p_accuracy > 100
     OR p_stars < 0 OR p_stars > 3 OR p_time_ms < 0 THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_prev FROM typing_game.lesson_progress
  WHERE user_id = v_me AND lesson_id = p_lesson_id FOR UPDATE;
  v_had := FOUND;
  v_first := NOT v_had OR v_prev.status = 'skipped';

  IF NOT v_had THEN
    INSERT INTO typing_game.lesson_progress
      (user_id, lesson_id, level_id, status, stars, best_wpm, best_accuracy,
       best_time_ms, last_time_ms, total_time_ms, attempts, completed_at)
    VALUES (v_me, p_lesson_id, p_level_id, 'completed', p_stars, p_wpm, p_accuracy,
            p_time_ms, p_time_ms, p_time_ms, 1, now());
  ELSE
    UPDATE typing_game.lesson_progress SET
      status = 'completed',
      stars = GREATEST(stars, p_stars),
      best_wpm = GREATEST(best_wpm, p_wpm),
      best_accuracy = GREATEST(best_accuracy, p_accuracy),
      best_time_ms = CASE WHEN best_time_ms IS NULL THEN p_time_ms ELSE LEAST(best_time_ms, p_time_ms) END,
      last_time_ms = p_time_ms,
      total_time_ms = total_time_ms + p_time_ms,
      attempts = attempts + 1,
      completed_at = COALESCE(completed_at, now()),
      updated_at = now()
    WHERE user_id = v_me AND lesson_id = p_lesson_id;
  END IF;

  v_xp := v_xp + typing_game.fn_lesson_award_xp(
    v_me, 20, 'lesson:' || p_lesson_id || ':complete', 'lesson completed',
    jsonb_build_object('lesson_id', p_lesson_id));
  FOR v_star IN 1..p_stars LOOP
    v_xp := v_xp + typing_game.fn_lesson_award_xp(
      v_me, 10, 'lesson:' || p_lesson_id || ':star:' || v_star, 'lesson star',
      jsonb_build_object('lesson_id', p_lesson_id, 'star', v_star));
  END LOOP;

  RETURN jsonb_build_object('xp', v_xp, 'first_completion', v_first);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_record_lesson_result(text, text, numeric, numeric, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_record_lesson_result(text, text, numeric, numeric, int, int) TO authenticated;

-- Marks lessons as skipped for the calling student (already-done ones are left alone).
CREATE OR REPLACE FUNCTION typing_game.fn_skip_lessons(p_lesson_ids text[], p_level_id text)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id text;
  v_n int := 0;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM typing_game.profiles WHERE id = v_me AND account_status = 'active') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_lesson_ids IS NULL OR array_length(p_lesson_ids, 1) > 100 OR p_level_id !~ '^[a-z]{2}-[0-9]+$' THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
  END IF;
  FOREACH v_id IN ARRAY p_lesson_ids LOOP
    IF v_id !~ '^[a-z]{2}-[0-9]+-[0-9]{2,3}$' THEN
      RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
    END IF;
    INSERT INTO typing_game.lesson_progress (user_id, lesson_id, level_id, status)
    VALUES (v_me, v_id, p_level_id, 'skipped')
    ON CONFLICT (user_id, lesson_id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_skip_lessons(text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_skip_lessons(text[], text) TO authenticated;
