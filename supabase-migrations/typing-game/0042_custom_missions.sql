-- Custom teacher-authored missions — replaces the daily/weekly auto-mission
-- system (0016-0018, left in place but unused) with teacher-paste-a-passage
-- missions: complete once / within a time limit / N repetitions, optional
-- min-accuracy / min-WPM gates, a reward, assigned to specific batches, with
-- a per-mission leaderboard whose ranking metric the teacher picks.
--
-- Deliberately self-contained: does NOT touch typing_game.games/game_attempts
-- (a GameDefinition can't carry literal text — see plan). Attempts live in
-- their own table; scoring numbers are computed in Node (reusing the same
-- pure diff/metrics functions the catalog submit route uses) and persisted
-- here, mirroring how fn_submit_attempt already trusts Node-computed values.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

DO $$ BEGIN
  CREATE TYPE typing_game.custom_mission_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typing_game.custom_mission_completion_mode AS ENUM ('once', 'timed', 'repetitions');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typing_game.custom_mission_leaderboard_metric AS ENUM (
    'fastest_time', 'highest_accuracy', 'highest_wpm', 'most_repetitions'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typing_game.custom_mission_attempt_status AS ENUM (
    'started', 'validated', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.custom_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  passage_text text NOT NULL CHECK (char_length(passage_text) BETWEEN 1 AND 20000),
  completion_mode typing_game.custom_mission_completion_mode NOT NULL,
  time_limit_seconds int CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
  repetitions_target int CHECK (repetitions_target IS NULL OR repetitions_target > 0),
  min_accuracy numeric CHECK (min_accuracy IS NULL OR (min_accuracy >= 0 AND min_accuracy <= 100)),
  min_wpm numeric CHECK (min_wpm IS NULL OR min_wpm >= 0),
  leaderboard_metric typing_game.custom_mission_leaderboard_metric NOT NULL DEFAULT 'fastest_time',
  reward_xp int NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  reward_coins int NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  status typing_game.custom_mission_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completion_mode <> 'timed' OR time_limit_seconds IS NOT NULL),
  CHECK (completion_mode <> 'repetitions' OR repetitions_target IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS custom_missions_teacher_idx ON typing_game.custom_missions (teacher_id);
CREATE INDEX IF NOT EXISTS custom_missions_status_idx ON typing_game.custom_missions (status);

-- Assignment AND visibility gate (stricter than competitions' eligibility-only
-- jsonb: a mission is only visible to students in one of these batches).
CREATE TABLE IF NOT EXISTS typing_game.custom_mission_batches (
  mission_id uuid NOT NULL REFERENCES typing_game.custom_missions (id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES typing_game.batches (id) ON DELETE CASCADE,
  PRIMARY KEY (mission_id, batch_id)
);
CREATE INDEX IF NOT EXISTS custom_mission_batches_batch_idx
  ON typing_game.custom_mission_batches (batch_id);

-- ---------------------------------------------------------------------------
-- Attempts — self-contained, no FK into typing_game.games/game_attempts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_game.custom_mission_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES typing_game.custom_missions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  status typing_game.custom_mission_attempt_status NOT NULL DEFAULT 'started',
  -- Frozen copy of the passage at attempt time — later teacher edits never
  -- retroactively invalidate a past attempt.
  expected_text text NOT NULL,
  typed_text text,
  elapsed_ms int CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
  corrections int NOT NULL DEFAULT 0,
  error_strokes int NOT NULL DEFAULT 0,
  incorrect_chars int NOT NULL DEFAULT 0,
  accuracy numeric CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)),
  effective_wpm numeric CHECK (effective_wpm IS NULL OR effective_wpm >= 0),
  score numeric,
  qualifies boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_mission_attempts_user_idx
  ON typing_game.custom_mission_attempts (mission_id, user_id);
CREATE INDEX IF NOT EXISTS custom_mission_attempts_qualifying_idx
  ON typing_game.custom_mission_attempts (mission_id, user_id) WHERE qualifies;

-- Reward-idempotency anchor (mirrors mission_completion_events).
CREATE TABLE IF NOT EXISTS typing_game.custom_mission_completions (
  mission_id uuid NOT NULL REFERENCES typing_game.custom_missions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  qualifying_attempt_id uuid REFERENCES typing_game.custom_mission_attempts (id) ON DELETE SET NULL,
  reward_awarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (mission_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- Creator teacher, or an org admin of any batch this mission is assigned to,
-- or super_admin. Mirrors fn_can_manage_competition's shape.
CREATE OR REPLACE FUNCTION typing_game.fn_can_manage_custom_mission(p_mission uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_teacher uuid;
BEGIN
  IF v_me IS NULL THEN
    RETURN false;
  END IF;
  IF typing_game.is_super_admin() THEN
    RETURN true;
  END IF;
  SELECT teacher_id INTO v_teacher FROM typing_game.custom_missions WHERE id = p_mission;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_teacher = v_me THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM typing_game.custom_mission_batches cmb
    WHERE cmb.mission_id = p_mission
      AND typing_game.is_org_admin(typing_game.batch_organization_id(cmb.batch_id))
  );
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_can_manage_custom_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_can_manage_custom_mission(uuid) TO authenticated;

-- Active mission + caller is an active member of one of its assigned batches.
CREATE OR REPLACE FUNCTION typing_game.fn_can_view_custom_mission(p_mission uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_status typing_game.custom_mission_status;
BEGIN
  IF v_me IS NULL THEN
    RETURN false;
  END IF;
  SELECT status INTO v_status FROM typing_game.custom_missions WHERE id = p_mission;
  IF NOT FOUND OR v_status <> 'active' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM typing_game.custom_mission_batches cmb
    JOIN typing_game.batch_members bm ON bm.batch_id = cmb.batch_id
    WHERE cmb.mission_id = p_mission AND bm.user_id = v_me AND bm.is_active
  );
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_can_view_custom_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_can_view_custom_mission(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_is_teacher_or_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM typing_game.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('teacher', 'admin', 'super_admin')
  );
$$;
REVOKE ALL ON FUNCTION typing_game.fn_is_teacher_or_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_is_teacher_or_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- Teacher CRUD
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_create_custom_mission(p_def jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT typing_game.fn_is_teacher_or_staff() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  INSERT INTO typing_game.custom_missions (
    teacher_id, title, description, passage_text, completion_mode,
    time_limit_seconds, repetitions_target, min_accuracy, min_wpm,
    leaderboard_metric, reward_xp, reward_coins
  ) VALUES (
    auth.uid(),
    p_def ->> 'title',
    COALESCE(p_def ->> 'description', ''),
    p_def ->> 'passageText',
    (p_def ->> 'completionMode')::typing_game.custom_mission_completion_mode,
    NULLIF(p_def ->> 'timeLimitSeconds', '')::int,
    NULLIF(p_def ->> 'repetitionsTarget', '')::int,
    NULLIF(p_def ->> 'minAccuracy', '')::numeric,
    NULLIF(p_def ->> 'minWpm', '')::numeric,
    COALESCE((p_def ->> 'leaderboardMetric')::typing_game.custom_mission_leaderboard_metric, 'fastest_time'),
    COALESCE((p_def ->> 'rewardXp')::int, 0),
    COALESCE((p_def ->> 'rewardCoins')::int, 0)
  ) RETURNING id INTO v_id;

  IF jsonb_typeof(p_def -> 'batchIds') = 'array' THEN
    INSERT INTO typing_game.custom_mission_batches (mission_id, batch_id)
    SELECT v_id, x::uuid FROM jsonb_array_elements_text(p_def -> 'batchIds') AS x
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_create_custom_mission(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_create_custom_mission(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_update_custom_mission_draft(p_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
BEGIN
  IF NOT typing_game.fn_can_manage_custom_mission(p_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF (SELECT status FROM typing_game.custom_missions WHERE id = p_id) <> 'draft' THEN
    RAISE EXCEPTION 'NOT_DRAFT';
  END IF;
  UPDATE typing_game.custom_missions SET
    title = COALESCE(p_patch ->> 'title', title),
    description = COALESCE(p_patch ->> 'description', description),
    passage_text = COALESCE(p_patch ->> 'passageText', passage_text),
    completion_mode = COALESCE((p_patch ->> 'completionMode')::typing_game.custom_mission_completion_mode, completion_mode),
    time_limit_seconds = CASE WHEN p_patch ? 'timeLimitSeconds' THEN NULLIF(p_patch ->> 'timeLimitSeconds', '')::int ELSE time_limit_seconds END,
    repetitions_target = CASE WHEN p_patch ? 'repetitionsTarget' THEN NULLIF(p_patch ->> 'repetitionsTarget', '')::int ELSE repetitions_target END,
    min_accuracy = CASE WHEN p_patch ? 'minAccuracy' THEN NULLIF(p_patch ->> 'minAccuracy', '')::numeric ELSE min_accuracy END,
    min_wpm = CASE WHEN p_patch ? 'minWpm' THEN NULLIF(p_patch ->> 'minWpm', '')::numeric ELSE min_wpm END,
    leaderboard_metric = COALESCE((p_patch ->> 'leaderboardMetric')::typing_game.custom_mission_leaderboard_metric, leaderboard_metric),
    reward_xp = COALESCE((p_patch ->> 'rewardXp')::int, reward_xp),
    reward_coins = COALESCE((p_patch ->> 'rewardCoins')::int, reward_coins),
    updated_at = now()
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_update_custom_mission_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_update_custom_mission_draft(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_set_custom_mission_batches(p_id uuid, p_batch_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
BEGIN
  IF NOT typing_game.fn_can_manage_custom_mission(p_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  DELETE FROM typing_game.custom_mission_batches WHERE mission_id = p_id;
  INSERT INTO typing_game.custom_mission_batches (mission_id, batch_id)
  SELECT p_id, b FROM unnest(p_batch_ids) AS b
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_set_custom_mission_batches(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_set_custom_mission_batches(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_set_custom_mission_status(
  p_id uuid, p_status typing_game.custom_mission_status
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
BEGIN
  IF NOT typing_game.fn_can_manage_custom_mission(p_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE typing_game.custom_missions SET status = p_status, updated_at = now() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_set_custom_mission_status(uuid, typing_game.custom_mission_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_set_custom_mission_status(uuid, typing_game.custom_mission_status) TO authenticated;

-- ---------------------------------------------------------------------------
-- Student attempt flow
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_start_custom_mission_attempt(p_mission uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_m record;
  v_attempt_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NOT typing_game.fn_can_view_custom_mission(p_mission) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM typing_game.custom_mission_completions
    WHERE mission_id = p_mission AND user_id = v_me
  ) THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED';
  END IF;
  SELECT * INTO v_m FROM typing_game.custom_missions WHERE id = p_mission;
  v_expires := now() + make_interval(secs => GREATEST(COALESCE(v_m.time_limit_seconds, 0), 3600));

  INSERT INTO typing_game.custom_mission_attempts (mission_id, user_id, expected_text, expires_at)
  VALUES (p_mission, v_me, v_m.passage_text, v_expires)
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_start_custom_mission_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_start_custom_mission_attempt(uuid) TO authenticated;

-- Node has already recomputed accuracy/wpm/score/incorrectChars from the
-- typed text via the same pure engine functions the catalog submit route
-- uses; this persists them, evaluates the mission's own completion rule,
-- and mints the reward exactly once (idempotent via custom_mission_completions'
-- PK + the xp/coin ledgers' UNIQUE(user_id, source, reference_id)).
CREATE OR REPLACE FUNCTION typing_game.fn_submit_custom_mission_attempt(
  p_attempt uuid, p_typed_text text, p_elapsed_ms int,
  p_corrections int, p_error_strokes int, p_incorrect_chars int,
  p_accuracy numeric, p_effective_wpm numeric, p_score numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_a typing_game.custom_mission_attempts;
  v_m typing_game.custom_missions;
  v_qualifies boolean;
  v_qual_count int;
  v_newly_completed boolean := false;
  v_key text;
BEGIN
  SELECT * INTO v_a FROM typing_game.custom_mission_attempts
  WHERE id = p_attempt AND user_id = v_me FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_a.status <> 'started' THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED';
  END IF;
  SELECT * INTO v_m FROM typing_game.custom_missions WHERE id = v_a.mission_id;

  v_qualifies :=
    p_accuracy >= COALESCE(v_m.min_accuracy, 0)
    AND p_effective_wpm >= COALESCE(v_m.min_wpm, 0)
    AND (v_m.completion_mode <> 'timed' OR p_elapsed_ms <= v_m.time_limit_seconds * 1000);

  UPDATE typing_game.custom_mission_attempts SET
    status = CASE WHEN now() > v_a.expires_at THEN 'expired' ELSE 'validated' END::typing_game.custom_mission_attempt_status,
    typed_text = p_typed_text,
    elapsed_ms = p_elapsed_ms,
    corrections = p_corrections,
    error_strokes = p_error_strokes,
    incorrect_chars = p_incorrect_chars,
    accuracy = p_accuracy,
    effective_wpm = p_effective_wpm,
    score = p_score,
    qualifies = v_qualifies AND now() <= v_a.expires_at,
    submitted_at = now()
  WHERE id = p_attempt
  RETURNING * INTO v_a;

  IF v_a.qualifies THEN
    IF v_m.completion_mode IN ('once', 'timed') THEN
      INSERT INTO typing_game.custom_mission_completions (mission_id, user_id, qualifying_attempt_id)
      VALUES (v_m.id, v_me, p_attempt)
      ON CONFLICT (mission_id, user_id) DO NOTHING;
      v_newly_completed := FOUND;
    ELSIF v_m.completion_mode = 'repetitions' THEN
      SELECT count(*) INTO v_qual_count FROM typing_game.custom_mission_attempts
      WHERE mission_id = v_m.id AND user_id = v_me AND qualifies;
      IF v_qual_count >= v_m.repetitions_target THEN
        INSERT INTO typing_game.custom_mission_completions (mission_id, user_id, qualifying_attempt_id)
        VALUES (v_m.id, v_me, p_attempt)
        ON CONFLICT (mission_id, user_id) DO NOTHING;
        v_newly_completed := FOUND;
      END IF;
    END IF;
  END IF;

  IF v_newly_completed THEN
    v_key := 'custom_mission:' || v_m.id::text || ':' || v_me::text || ':completion:v1';
    IF v_m.reward_xp > 0 THEN
      INSERT INTO typing_game.xp_ledger
        (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
      SELECT v_me, v_m.reward_xp, 'custom_mission', 'custom_mission', v_key,
             'custom mission completion', jsonb_build_object('mission_id', v_m.id),
             COALESCE(xp_total, 0) + v_m.reward_xp
      FROM typing_game.profiles WHERE id = v_me
      ON CONFLICT (user_id, source, reference_id) DO NOTHING;
      UPDATE typing_game.profiles
      SET xp_total = xp_total + v_m.reward_xp,
          current_level = (SELECT max(level) FROM typing_game.levels WHERE required_xp <= xp_total + v_m.reward_xp)
      WHERE id = v_me
        AND EXISTS (SELECT 1 FROM typing_game.xp_ledger WHERE user_id = v_me AND reference_id = v_key);
    END IF;
    IF v_m.reward_coins > 0 THEN
      INSERT INTO typing_game.coin_ledger
        (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
      SELECT v_me, v_m.reward_coins, 'custom_mission', 'custom_mission', v_key,
             'custom mission completion', jsonb_build_object('mission_id', v_m.id),
             COALESCE(coin_balance, 0) + v_m.reward_coins
      FROM typing_game.profiles WHERE id = v_me
      ON CONFLICT (user_id, source, reference_id) DO NOTHING;
      UPDATE typing_game.profiles SET coin_balance = coin_balance + v_m.reward_coins
      WHERE id = v_me
        AND EXISTS (SELECT 1 FROM typing_game.coin_ledger WHERE user_id = v_me AND reference_id = v_key);
    END IF;
    UPDATE typing_game.custom_mission_completions
    SET reward_awarded = true
    WHERE mission_id = v_m.id AND user_id = v_me;
  END IF;

  RETURN jsonb_build_object(
    'status', v_a.status,
    'qualifies', v_a.qualifies,
    'completed', v_newly_completed OR EXISTS (
      SELECT 1 FROM typing_game.custom_mission_completions
      WHERE mission_id = v_m.id AND user_id = v_me
    ),
    'newlyCompleted', v_newly_completed
  );
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_submit_custom_mission_attempt(uuid, text, int, int, int, int, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_submit_custom_mission_attempt(uuid, text, int, int, int, int, numeric, numeric, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard — ranked per the mission's own leaderboard_metric.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_custom_mission_leaderboard(p_mission uuid)
RETURNS TABLE (
  rank int, user_id uuid, full_name text, roll_number text,
  metric_value numeric, qualifying_attempts int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_metric typing_game.custom_mission_leaderboard_metric;
BEGIN
  IF NOT (typing_game.fn_can_manage_custom_mission(p_mission) OR typing_game.fn_can_view_custom_mission(p_mission)) THEN
    RETURN;
  END IF;
  SELECT leaderboard_metric INTO v_metric FROM typing_game.custom_missions WHERE id = p_mission;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH per_user AS (
    SELECT
      a.user_id,
      count(*) FILTER (WHERE a.qualifies)::int AS qualifying_attempts,
      min(a.elapsed_ms) FILTER (WHERE a.qualifies) AS best_time,
      max(a.accuracy) FILTER (WHERE a.qualifies) AS best_accuracy,
      max(a.effective_wpm) FILTER (WHERE a.qualifies) AS best_wpm
    FROM typing_game.custom_mission_attempts a
    WHERE a.mission_id = p_mission AND a.qualifies
    GROUP BY a.user_id
  ),
  scored AS (
    SELECT
      pu.user_id,
      pu.qualifying_attempts,
      CASE v_metric
        WHEN 'fastest_time' THEN pu.best_time::numeric
        WHEN 'highest_accuracy' THEN pu.best_accuracy
        WHEN 'highest_wpm' THEN pu.best_wpm
        WHEN 'most_repetitions' THEN pu.qualifying_attempts::numeric
      END AS metric_value
    FROM per_user pu
  )
  SELECT
    RANK() OVER (
      ORDER BY (CASE WHEN v_metric = 'fastest_time' THEN s.metric_value END) ASC NULLS LAST,
               (CASE WHEN v_metric <> 'fastest_time' THEN s.metric_value END) DESC NULLS LAST
    )::int AS rank,
    s.user_id, p.full_name, bm.roll_number, s.metric_value, s.qualifying_attempts
  FROM scored s
  JOIN typing_game.profiles p ON p.id = s.user_id
  LEFT JOIN typing_game.custom_mission_batches cmb ON cmb.mission_id = p_mission
  LEFT JOIN typing_game.batch_members bm ON bm.user_id = s.user_id AND bm.batch_id = cmb.batch_id AND bm.is_active
  ORDER BY rank;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_custom_mission_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_custom_mission_leaderboard(uuid) TO authenticated;

-- Teacher/admin roster: every active member of an assigned batch (even if
-- they haven't attempted yet), with completion + attempt stats, plus overall
-- games-played/level so a teacher can see where each student stands.
CREATE OR REPLACE FUNCTION typing_game.fn_custom_mission_roster(p_mission uuid)
RETURNS TABLE (
  user_id uuid, full_name text, roll_number text, current_level int, games_played int,
  completed boolean, completed_at timestamptz,
  qualifying_attempts int, total_attempts int,
  best_elapsed_ms int, best_accuracy numeric, best_wpm numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
BEGIN
  IF NOT typing_game.fn_can_manage_custom_mission(p_mission) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (bm.user_id)
    bm.user_id, p.full_name, bm.roll_number,
    COALESCE(p.current_level, 1),
    COALESCE(gp.games_played, 0)::int,
    (c.user_id IS NOT NULL) AS completed, c.completed_at,
    COALESCE(agg.qualifying_attempts, 0)::int,
    COALESCE(agg.total_attempts, 0)::int,
    agg.best_elapsed_ms, agg.best_accuracy, agg.best_wpm
  FROM typing_game.custom_mission_batches cmb
  JOIN typing_game.batch_members bm ON bm.batch_id = cmb.batch_id AND bm.is_active
  JOIN typing_game.profiles p ON p.id = bm.user_id
  LEFT JOIN typing_game.custom_mission_completions c
    ON c.mission_id = p_mission AND c.user_id = bm.user_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE a.qualifies)::int AS qualifying_attempts,
      count(*)::int AS total_attempts,
      min(a.elapsed_ms) FILTER (WHERE a.qualifies) AS best_elapsed_ms,
      max(a.accuracy) FILTER (WHERE a.qualifies) AS best_accuracy,
      max(a.effective_wpm) FILTER (WHERE a.qualifies) AS best_wpm
    FROM typing_game.custom_mission_attempts a
    WHERE a.mission_id = p_mission AND a.user_id = bm.user_id
  ) agg ON true
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT ga.game_id)::int AS games_played
    FROM typing_game.game_attempts ga
    WHERE ga.user_id = bm.user_id AND ga.status = 'validated'
  ) gp ON true
  WHERE cmb.mission_id = p_mission
  ORDER BY bm.user_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_custom_mission_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_custom_mission_roster(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE typing_game.custom_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.custom_mission_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.custom_mission_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.custom_mission_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_missions_select ON typing_game.custom_missions;
CREATE POLICY custom_missions_select ON typing_game.custom_missions
  FOR SELECT TO authenticated
  USING (
    typing_game.fn_can_manage_custom_mission(id)
    OR typing_game.fn_can_view_custom_mission(id)
  );

DROP POLICY IF EXISTS custom_mission_batches_select ON typing_game.custom_mission_batches;
CREATE POLICY custom_mission_batches_select ON typing_game.custom_mission_batches
  FOR SELECT TO authenticated
  USING (
    typing_game.fn_can_manage_custom_mission(mission_id)
    OR EXISTS (
      SELECT 1 FROM typing_game.batch_members bm
      WHERE bm.batch_id = custom_mission_batches.batch_id
        AND bm.user_id = auth.uid() AND bm.is_active
    )
  );

DROP POLICY IF EXISTS custom_mission_attempts_select_own ON typing_game.custom_mission_attempts;
CREATE POLICY custom_mission_attempts_select_own ON typing_game.custom_mission_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS custom_mission_attempts_select_manager ON typing_game.custom_mission_attempts;
CREATE POLICY custom_mission_attempts_select_manager ON typing_game.custom_mission_attempts
  FOR SELECT TO authenticated
  USING (typing_game.fn_can_manage_custom_mission(mission_id));

DROP POLICY IF EXISTS custom_mission_completions_select_own ON typing_game.custom_mission_completions;
CREATE POLICY custom_mission_completions_select_own ON typing_game.custom_mission_completions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS custom_mission_completions_select_manager ON typing_game.custom_mission_completions;
CREATE POLICY custom_mission_completions_select_manager ON typing_game.custom_mission_completions
  FOR SELECT TO authenticated
  USING (typing_game.fn_can_manage_custom_mission(mission_id));
