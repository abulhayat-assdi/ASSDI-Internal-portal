-- Batch competition: a student invites a batchmate to type the same passage.
--
--   async ("challenge"): each player plays whenever they like within 24 h.
--   live  ("race"):      both open the race, the server starts a shared
--                        countdown, progress is shown live to each other.
--
-- The server owns the clock: a player's time is measured from the server's
-- own start (their start for async, the shared start for live) to the
-- server's receipt of their finish, so the browser cannot report a time.
-- Rewards: winner +20 coins +15 XP, loser +5 XP, draw +10 coins +10 XP each,
-- for each player's first 5 rewarded challenges a day. Gated by the
-- BATCH_COMPETITION_ENABLED flag (0052).

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE TABLE IF NOT EXISTS typing_game.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES typing_game.batches (id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('async', 'live')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'running', 'finished', 'declined', 'expired', 'cancelled')),
  text text NOT NULL CHECK (char_length(text) BETWEEN 20 AND 600),
  time_limit_s int NOT NULL DEFAULT 180,
  created_by uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  starts_at timestamptz,
  finished_at timestamptz,
  winner_id uuid,
  CHECK (created_by <> opponent_id)
);
CREATE INDEX IF NOT EXISTS challenges_created_by_idx ON typing_game.challenges (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS challenges_opponent_idx ON typing_game.challenges (opponent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS challenges_batch_idx ON typing_game.challenges (batch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS typing_game.challenge_players (
  challenge_id uuid NOT NULL REFERENCES typing_game.challenges (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  seen_at timestamptz,
  started_at timestamptz,
  progress int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  finished_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  time_ms int,
  wpm numeric,
  accuracy numeric,
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS challenge_players_user_idx ON typing_game.challenge_players (user_id);

ALTER TABLE typing_game.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.challenge_players ENABLE ROW LEVEL SECURITY;
-- Students go through the functions below; staff may read for reports.
DROP POLICY IF EXISTS challenges_staff ON typing_game.challenges;
CREATE POLICY challenges_staff ON typing_game.challenges FOR SELECT TO authenticated
  USING (typing_game.is_org_admin(typing_game.batch_organization_id(batch_id)) OR typing_game.is_teacher_of_batch(batch_id));
DROP POLICY IF EXISTS challenge_players_staff ON typing_game.challenge_players;
CREATE POLICY challenge_players_staff ON typing_game.challenge_players FOR SELECT TO authenticated
  USING (typing_game.is_org_admin_of_user(user_id) OR typing_game.fn_teaches_student(user_id));
GRANT SELECT ON typing_game.challenges, typing_game.challenge_players TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- The newest active batch both users are in (NULL when none).
CREATE OR REPLACE FUNCTION typing_game.fn_shared_batch(p_a uuid, p_b uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT a.batch_id
  FROM typing_game.batch_members a
  JOIN typing_game.batch_members b ON b.batch_id = a.batch_id AND b.user_id = p_b AND b.is_active
  JOIN typing_game.batches x ON x.id = a.batch_id AND x.is_active
  WHERE a.user_id = p_a AND a.is_active
  ORDER BY a.joined_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_shared_batch(uuid, uuid) FROM PUBLIC;

-- Grant XP/coins with ledger rows (same bookkeeping as the arcade).
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_award(p_user uuid, p_xp int, p_coins int, p_ref text, p_meta jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE v_prof record;
BEGIN
  IF p_xp <= 0 AND p_coins <= 0 THEN RETURN; END IF;
  SELECT xp_total, coin_balance INTO v_prof FROM typing_game.profiles WHERE id = p_user FOR UPDATE;
  IF p_xp > 0 THEN
    INSERT INTO typing_game.xp_ledger (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
    VALUES (p_user, p_xp, 'challenge', 'challenge', p_ref, 'batch challenge', p_meta, v_prof.xp_total + p_xp);
  END IF;
  IF p_coins > 0 THEN
    INSERT INTO typing_game.coin_ledger (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
    VALUES (p_user, p_coins, 'challenge', 'challenge', p_ref, 'batch challenge', p_meta, v_prof.coin_balance + p_coins);
  END IF;
  UPDATE typing_game.profiles SET
    xp_total = v_prof.xp_total + GREATEST(p_xp, 0),
    coin_balance = v_prof.coin_balance + GREATEST(p_coins, 0),
    current_level = COALESCE((SELECT max(level) FROM typing_game.levels WHERE required_xp <= v_prof.xp_total + GREATEST(p_xp, 0)), current_level)
  WHERE id = p_user;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_award(uuid, int, int, text, jsonb) FROM PUBLIC;

-- Settle a challenge when it is over (both done, time up, or expired). Idempotent.
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_settle(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  c typing_game.challenges%ROWTYPE;
  v_done int;
  v_played int;
  v_over boolean;
  a record;
  b record;
  v_cmp int;
  v_day timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka';
  v_ref text := 'challenge:' || p_id::text;
  v_meta jsonb;
BEGIN
  SELECT * INTO c FROM typing_game.challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.status IN ('finished', 'declined', 'expired', 'cancelled') THEN RETURN; END IF;

  -- Live race: a player still racing after the limit (+10 s grace) is stopped where they are.
  IF c.mode = 'live' AND c.status = 'running' AND now() > c.starts_at + make_interval(secs => c.time_limit_s + 10) THEN
    UPDATE typing_game.challenge_players SET finished_at = now(), time_ms = c.time_limit_s * 1000,
      wpm = round((progress / 5.0) / (c.time_limit_s / 60.0), 1),
      accuracy = CASE WHEN progress + errors > 0 THEN round(100.0 * progress / (progress + errors), 1) ELSE 0 END
    WHERE challenge_id = p_id AND finished_at IS NULL;
  END IF;

  SELECT count(*) FILTER (WHERE finished_at IS NOT NULL), count(*) FILTER (WHERE started_at IS NOT NULL OR finished_at IS NOT NULL)
    INTO v_done, v_played FROM typing_game.challenge_players WHERE challenge_id = p_id;

  v_over := v_done = 2 OR now() > c.expires_at;
  IF NOT v_over THEN RETURN; END IF;

  IF v_done < 2 THEN
    -- Expired before both played: a walkover for whoever finished, no rewards.
    UPDATE typing_game.challenges SET status = 'expired', finished_at = now(),
      winner_id = (SELECT user_id FROM typing_game.challenge_players WHERE challenge_id = p_id AND finished_at IS NOT NULL LIMIT 1)
    WHERE id = p_id;
    RETURN;
  END IF;

  SELECT * INTO a FROM typing_game.challenge_players WHERE challenge_id = p_id AND user_id = c.created_by;
  SELECT * INTO b FROM typing_game.challenge_players WHERE challenge_id = p_id AND user_id = c.opponent_id;
  -- Better = completed, then faster (or further when neither completed), then more accurate.
  v_cmp := CASE
    WHEN a.completed AND NOT b.completed THEN 1
    WHEN b.completed AND NOT a.completed THEN -1
    WHEN a.completed AND b.completed AND a.time_ms <> b.time_ms THEN CASE WHEN a.time_ms < b.time_ms THEN 1 ELSE -1 END
    WHEN NOT a.completed AND a.progress <> b.progress THEN CASE WHEN a.progress > b.progress THEN 1 ELSE -1 END
    WHEN COALESCE(a.accuracy, 0) <> COALESCE(b.accuracy, 0) THEN CASE WHEN COALESCE(a.accuracy, 0) > COALESCE(b.accuracy, 0) THEN 1 ELSE -1 END
    ELSE 0 END;

  UPDATE typing_game.challenges SET status = 'finished', finished_at = now(),
    winner_id = CASE v_cmp WHEN 1 THEN c.created_by WHEN -1 THEN c.opponent_id ELSE NULL END
  WHERE id = p_id;

  FOR a IN SELECT * FROM typing_game.challenge_players WHERE challenge_id = p_id LOOP
    -- Daily cap: the first 5 rewarded challenges of the day (Dhaka time).
    IF (SELECT count(*) FROM typing_game.challenge_players p JOIN typing_game.challenges x ON x.id = p.challenge_id
        WHERE p.user_id = a.user_id AND x.finished_at >= v_day AND (p.xp > 0 OR p.coins > 0)) >= 5 THEN
      CONTINUE;
    END IF;
    DECLARE
      v_xp int; v_coins int; v_res text;
    BEGIN
      IF v_cmp = 0 THEN v_xp := 10; v_coins := 10; v_res := 'draw';
      ELSIF (v_cmp = 1) = (a.user_id = c.created_by) THEN v_xp := 15; v_coins := 20; v_res := 'win';
      ELSE v_xp := 5; v_coins := 0; v_res := 'loss';
      END IF;
      -- A run with almost nothing typed earns nothing.
      IF a.progress < 20 THEN v_xp := 0; v_coins := 0; END IF;
      UPDATE typing_game.challenge_players SET xp = v_xp, coins = v_coins WHERE challenge_id = p_id AND user_id = a.user_id;
      v_meta := jsonb_build_object('challenge', p_id, 'mode', c.mode, 'result', v_res);
      PERFORM typing_game.fn_challenge_award(a.user_id, v_xp, v_coins, v_ref, v_meta);
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_settle(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Student API
-- ---------------------------------------------------------------------------
-- Batchmates I can challenge, with a little context.
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_batchmates()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  WITH mine AS (
    SELECT bm.batch_id FROM typing_game.batch_members bm JOIN typing_game.batches b ON b.id = bm.batch_id AND b.is_active
    WHERE bm.user_id = auth.uid() AND bm.is_active
  ), mates AS (
    SELECT DISTINCT ON (bm.user_id) bm.user_id, bm.roll_number, b.name AS batch
    FROM typing_game.batch_members bm JOIN mine USING (batch_id) JOIN typing_game.batches b ON b.id = bm.batch_id
    WHERE bm.is_active AND bm.user_id <> auth.uid()
    ORDER BY bm.user_id
  )
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'userId', m.user_id, 'name', p.full_name, 'roll', m.roll_number, 'batch', m.batch, 'level', p.current_level,
      'bestWpm', (SELECT round(max(wpm)) FROM typing_game.typing_test_sessions t WHERE t.user_id = m.user_id AND t.status = 'graded'),
      'activeToday', EXISTS (SELECT 1 FROM typing_game.daily_activity d WHERE d.user_id = m.user_id
                             AND d.day = (now() AT TIME ZONE 'Asia/Dhaka')::date AND d.typing_ms > 0),
      'wins', (SELECT count(*) FROM typing_game.challenges x WHERE x.winner_id = m.user_id AND x.status = 'finished'),
      'openId', (SELECT x.id FROM typing_game.challenges x
                 WHERE x.status IN ('pending', 'accepted', 'running')
                   AND ((x.created_by = auth.uid() AND x.opponent_id = m.user_id) OR (x.created_by = m.user_id AND x.opponent_id = auth.uid()))
                 LIMIT 1)
    ) AS row
    FROM mates m JOIN typing_game.profiles p ON p.id = m.user_id
    WHERE p.account_status = 'active'
  ) s;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_batchmates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_batchmates() TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_challenge_create(p_opponent uuid, p_mode text, p_text text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_batch uuid;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_mode NOT IN ('async', 'live') OR p_text IS NULL OR char_length(p_text) NOT BETWEEN 20 AND 600 THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
  END IF;
  v_batch := typing_game.fn_shared_batch(v_me, p_opponent);
  IF v_batch IS NULL OR v_me = p_opponent THEN RAISE EXCEPTION 'NOT_BATCHMATE' USING ERRCODE = '42501'; END IF;
  IF NOT typing_game.fn_feature_on('BATCH_COMPETITION_ENABLED', typing_game.batch_organization_id(v_batch)) THEN
    RAISE EXCEPTION 'FEATURE_OFF' USING ERRCODE = '42501';
  END IF;
  IF COALESCE((SELECT account_status FROM typing_game.profiles WHERE id = p_opponent), '') <> 'active' THEN
    RAISE EXCEPTION 'NOT_BATCHMATE' USING ERRCODE = '42501';
  END IF;

  -- Close what has run out before counting what is open.
  PERFORM typing_game.fn_challenge_settle(x.id) FROM typing_game.challenges x
  WHERE x.status IN ('pending', 'accepted', 'running') AND (x.created_by = v_me OR x.opponent_id = v_me);

  IF EXISTS (SELECT 1 FROM typing_game.challenges x WHERE x.status IN ('pending', 'accepted', 'running')
             AND ((x.created_by = v_me AND x.opponent_id = p_opponent) OR (x.created_by = p_opponent AND x.opponent_id = v_me))) THEN
    RAISE EXCEPTION 'ALREADY_OPEN' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM typing_game.challenges x WHERE x.created_by = v_me AND x.status IN ('pending', 'accepted', 'running')) >= 10 THEN
    RAISE EXCEPTION 'TOO_MANY_OPEN' USING ERRCODE = '54000';
  END IF;

  INSERT INTO typing_game.challenges (batch_id, mode, text, created_by, opponent_id, expires_at)
  VALUES (v_batch, p_mode, p_text, v_me, p_opponent,
          now() + CASE p_mode WHEN 'live' THEN interval '15 minutes' ELSE interval '24 hours' END)
  RETURNING id INTO v_id;
  INSERT INTO typing_game.challenge_players (challenge_id, user_id, seen_at)
  VALUES (v_id, v_me, CASE WHEN p_mode = 'live' THEN now() END), (v_id, p_opponent, NULL);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_create(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_create(uuid, text, text) TO authenticated;

-- Accept / decline (opponent) or cancel (creator, before anyone played).
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_respond(p_id uuid, p_action text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  c typing_game.challenges%ROWTYPE;
BEGIN
  PERFORM typing_game.fn_challenge_settle(p_id);
  SELECT * INTO c FROM typing_game.challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (c.created_by, c.opponent_id) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF p_action = 'cancel' THEN
    IF v_me <> c.created_by OR c.status NOT IN ('pending', 'accepted')
       OR EXISTS (SELECT 1 FROM typing_game.challenge_players WHERE challenge_id = p_id AND started_at IS NOT NULL) THEN
      RAISE EXCEPTION 'CANNOT_CANCEL' USING ERRCODE = '55000';
    END IF;
    UPDATE typing_game.challenges SET status = 'cancelled', finished_at = now() WHERE id = p_id;
  ELSIF p_action IN ('accept', 'decline') THEN
    IF v_me <> c.opponent_id OR c.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING' USING ERRCODE = '55000'; END IF;
    IF p_action = 'decline' THEN
      UPDATE typing_game.challenges SET status = 'declined', finished_at = now() WHERE id = p_id;
    ELSE
      UPDATE typing_game.challenges SET status = 'accepted',
        expires_at = CASE WHEN c.mode = 'live' THEN now() + interval '15 minutes' ELSE c.expires_at END
      WHERE id = p_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
  END IF;
  RETURN (SELECT status FROM typing_game.challenges WHERE id = p_id);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_respond(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_respond(uuid, text) TO authenticated;

-- One read of a challenge for a player. p_presence marks "I am on the race
-- page" (live); when both are present the server starts a 5 s countdown.
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_state(p_id uuid, p_presence boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  c typing_game.challenges%ROWTYPE;
  v_mine typing_game.challenge_players%ROWTYPE;
  v_show_text boolean;
BEGIN
  PERFORM typing_game.fn_challenge_settle(p_id);
  SELECT * INTO c FROM typing_game.challenges WHERE id = p_id;
  IF NOT FOUND OR v_me NOT IN (c.created_by, c.opponent_id) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF p_presence AND c.mode = 'live' AND c.status = 'accepted' THEN
    UPDATE typing_game.challenge_players SET seen_at = now() WHERE challenge_id = p_id AND user_id = v_me;
    IF (SELECT count(*) FROM typing_game.challenge_players WHERE challenge_id = p_id AND seen_at > now() - interval '6 seconds') = 2 THEN
      UPDATE typing_game.challenges SET status = 'running', starts_at = now() + interval '5 seconds',
        expires_at = now() + make_interval(secs => time_limit_s + 60)
      WHERE id = p_id AND status = 'accepted';
      UPDATE typing_game.challenge_players SET started_at = now() + interval '5 seconds' WHERE challenge_id = p_id;
    END IF;
    SELECT * INTO c FROM typing_game.challenges WHERE id = p_id;
  END IF;

  SELECT * INTO v_mine FROM typing_game.challenge_players WHERE challenge_id = p_id AND user_id = v_me;
  v_show_text := c.status IN ('finished', 'expired')
    OR (c.mode = 'live' AND c.status = 'running')
    OR (c.mode = 'async' AND v_mine.started_at IS NOT NULL);

  RETURN jsonb_build_object(
    'id', c.id, 'mode', c.mode, 'status', c.status, 'me', v_me,
    'createdBy', c.created_by, 'opponentId', c.opponent_id, 'winnerId', c.winner_id,
    'timeLimitS', c.time_limit_s, 'textLength', char_length(c.text),
    'text', CASE WHEN v_show_text THEN c.text END,
    'expiresInMs', GREATEST(0, (extract(epoch FROM c.expires_at - now()) * 1000)::bigint),
    'startsInMs', CASE WHEN c.starts_at IS NOT NULL THEN (extract(epoch FROM c.starts_at - now()) * 1000)::bigint END,
    'myElapsedMs', CASE WHEN v_mine.started_at IS NOT NULL AND v_mine.finished_at IS NULL
                        THEN (extract(epoch FROM now() - v_mine.started_at) * 1000)::bigint END,
    'players', (SELECT jsonb_agg(jsonb_build_object(
        'userId', p.user_id, 'name', pr.full_name, 'level', pr.current_level,
        'present', COALESCE(p.seen_at > now() - interval '6 seconds', false),
        'started', p.started_at IS NOT NULL AND p.started_at <= now(),
        -- An async opponent's numbers stay hidden until I have finished too.
        'progress', CASE WHEN p.user_id = v_me OR c.mode = 'live' OR v_mine.finished_at IS NOT NULL OR c.status IN ('finished', 'expired') THEN p.progress END,
        'finished', p.finished_at IS NOT NULL,
        'completed', CASE WHEN p.user_id = v_me OR c.mode = 'live' OR v_mine.finished_at IS NOT NULL OR c.status IN ('finished', 'expired') THEN p.completed END,
        'timeMs', CASE WHEN p.user_id = v_me OR c.mode = 'live' OR v_mine.finished_at IS NOT NULL OR c.status IN ('finished', 'expired') THEN p.time_ms END,
        'wpm', CASE WHEN p.user_id = v_me OR c.mode = 'live' OR v_mine.finished_at IS NOT NULL OR c.status IN ('finished', 'expired') THEN p.wpm END,
        'accuracy', CASE WHEN p.user_id = v_me OR c.mode = 'live' OR v_mine.finished_at IS NOT NULL OR c.status IN ('finished', 'expired') THEN p.accuracy END,
        'xp', p.xp, 'coins', p.coins) ORDER BY p.user_id = c.created_by DESC)
      FROM typing_game.challenge_players p JOIN typing_game.profiles pr ON pr.id = p.user_id
      WHERE p.challenge_id = p_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_state(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_state(uuid, boolean) TO authenticated;

-- Async: start my run (the server clock starts now; a reload keeps the first start).
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_begin(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  c typing_game.challenges%ROWTYPE;
BEGIN
  PERFORM typing_game.fn_challenge_settle(p_id);
  SELECT * INTO c FROM typing_game.challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (c.created_by, c.opponent_id) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF c.mode <> 'async' OR c.status NOT IN ('pending', 'accepted') THEN RAISE EXCEPTION 'NOT_OPEN' USING ERRCODE = '55000'; END IF;
  -- Playing an invitation accepts it.
  IF v_me = c.opponent_id AND c.status = 'pending' THEN
    UPDATE typing_game.challenges SET status = 'accepted' WHERE id = p_id;
  END IF;
  UPDATE typing_game.challenge_players SET started_at = now(), seen_at = now()
  WHERE challenge_id = p_id AND user_id = v_me AND started_at IS NULL;
  IF EXISTS (SELECT 1 FROM typing_game.challenge_players WHERE challenge_id = p_id AND user_id = v_me AND finished_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ALREADY_PLAYED' USING ERRCODE = '55000';
  END IF;
  RETURN typing_game.fn_challenge_state(p_id, false);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_begin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_begin(uuid) TO authenticated;

-- Live: report how far I am (characters typed correctly so far).
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_progress(p_id uuid, p_progress int, p_errors int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  c typing_game.challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM typing_game.challenges WHERE id = p_id;
  IF NOT FOUND OR v_me NOT IN (c.created_by, c.opponent_id) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF c.status <> 'running' OR now() < c.starts_at THEN RETURN; END IF;
  -- No faster than 250 wpm since the start.
  UPDATE typing_game.challenge_players SET
    progress = GREATEST(progress, LEAST(p_progress, char_length(c.text),
                 (extract(epoch FROM now() - c.starts_at) * 1000 / 48)::int + 5)),
    errors = GREATEST(errors, LEAST(GREATEST(p_errors, 0), 5000)),
    seen_at = now()
  WHERE challenge_id = p_id AND user_id = v_me AND finished_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_progress(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_progress(uuid, int, int) TO authenticated;

-- Finish my run. The time is the server's: now() minus my server-side start.
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_finish(p_id uuid, p_progress int, p_errors int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  c typing_game.challenges%ROWTYPE;
  p typing_game.challenge_players%ROWTYPE;
  v_len int;
  v_prog int;
  v_err int := LEAST(GREATEST(COALESCE(p_errors, 0), 0), 5000);
  v_ms int;
BEGIN
  SELECT * INTO c FROM typing_game.challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_me NOT IN (c.created_by, c.opponent_id) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO p FROM typing_game.challenge_players WHERE challenge_id = p_id AND user_id = v_me FOR UPDATE;
  IF p.finished_at IS NOT NULL THEN RETURN typing_game.fn_challenge_state(p_id, false); END IF;
  IF p.started_at IS NULL OR now() < p.started_at OR c.status NOT IN ('accepted', 'running', 'pending') THEN
    RAISE EXCEPTION 'NOT_STARTED' USING ERRCODE = '55000';
  END IF;

  v_len := char_length(c.text);
  v_prog := LEAST(GREATEST(COALESCE(p_progress, 0), 0), v_len);
  v_ms := LEAST((extract(epoch FROM now() - p.started_at) * 1000)::int, c.time_limit_s * 1000);
  -- 250 wpm = 48 ms a character; anything faster is not a person typing.
  IF v_prog > 0 AND v_ms < v_prog * 48 THEN RAISE EXCEPTION 'TOO_FAST' USING ERRCODE = '22023'; END IF;

  UPDATE typing_game.challenge_players SET
    finished_at = now(), progress = v_prog, errors = GREATEST(errors, v_err), completed = v_prog >= v_len,
    time_ms = GREATEST(v_ms, 1),
    wpm = round((v_prog / 5.0) / (GREATEST(v_ms, 1) / 60000.0), 1),
    accuracy = CASE WHEN v_prog + v_err > 0 THEN round(100.0 * v_prog / (v_prog + v_err), 1) ELSE 0 END
  WHERE challenge_id = p_id AND user_id = v_me;

  PERFORM typing_game.fn_add_typing_time(v_ms);
  PERFORM typing_game.fn_challenge_settle(p_id);
  RETURN typing_game.fn_challenge_state(p_id, false);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_finish(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_finish(uuid, int, int) TO authenticated;

-- My challenges (open first, then recent) and this month's batch standings.
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_month timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka';
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  PERFORM typing_game.fn_challenge_settle(x.id) FROM typing_game.challenges x
  WHERE x.status IN ('pending', 'accepted', 'running') AND (x.created_by = v_me OR x.opponent_id = v_me);

  RETURN jsonb_build_object(
    'enabled', typing_game.fn_feature_on('BATCH_COMPETITION_ENABLED', typing_game.fn_user_org(v_me)),
    'challenges', (SELECT COALESCE(jsonb_agg(row ORDER BY open DESC, created DESC), '[]'::jsonb) FROM (
      SELECT x.status IN ('pending', 'accepted', 'running') AS open, x.created_at AS created,
        jsonb_build_object(
          'id', x.id, 'mode', x.mode, 'status', x.status, 'createdAt', x.created_at,
          'expiresInMs', GREATEST(0, (extract(epoch FROM x.expires_at - now()) * 1000)::bigint),
          'incoming', x.opponent_id = v_me,
          'opponentId', CASE WHEN x.created_by = v_me THEN x.opponent_id ELSE x.created_by END,
          'opponentName', o.full_name,
          'winnerId', x.winner_id,
          'iPlayed', me.finished_at IS NOT NULL, 'iStarted', me.started_at IS NOT NULL,
          'theyPlayed', them.finished_at IS NOT NULL,
          'myWpm', me.wpm, 'theirWpm', CASE WHEN me.finished_at IS NOT NULL OR x.status IN ('finished', 'expired') THEN them.wpm END,
          'myAccuracy', me.accuracy, 'xp', me.xp, 'coins', me.coins) AS row
      FROM typing_game.challenges x
      JOIN typing_game.challenge_players me ON me.challenge_id = x.id AND me.user_id = v_me
      JOIN typing_game.challenge_players them ON them.challenge_id = x.id AND them.user_id <> v_me
      JOIN typing_game.profiles o ON o.id = them.user_id
      WHERE x.status IN ('pending', 'accepted', 'running') OR x.created_at > now() - interval '30 days'
      ORDER BY x.created_at DESC LIMIT 40) s),
    'record', (SELECT jsonb_build_object(
        'wins', count(*) FILTER (WHERE x.winner_id = v_me AND x.status = 'finished'),
        'losses', count(*) FILTER (WHERE x.winner_id IS NOT NULL AND x.winner_id <> v_me AND x.status = 'finished'),
        'draws', count(*) FILTER (WHERE x.winner_id IS NULL AND x.status = 'finished'))
      FROM typing_game.challenges x WHERE x.status = 'finished' AND v_me IN (x.created_by, x.opponent_id)),
    'standings', (SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'wins')::int DESC, (row->>'played')::int DESC, row->>'name'), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('userId', p.user_id, 'name', pr.full_name,
        'wins', count(*) FILTER (WHERE x.winner_id = p.user_id), 'played', count(*)) AS row
      FROM typing_game.challenges x
      JOIN typing_game.challenge_players p ON p.challenge_id = x.id
      JOIN typing_game.profiles pr ON pr.id = p.user_id
      WHERE x.status = 'finished' AND x.finished_at >= v_month
        AND x.batch_id IN (SELECT batch_id FROM typing_game.batch_members WHERE user_id = v_me AND is_active)
      GROUP BY p.user_id, pr.full_name
      ORDER BY count(*) FILTER (WHERE x.winner_id = p.user_id) DESC LIMIT 10) s)
  );
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_overview() TO authenticated;

-- Open invitations waiting for me (for the nav badge).
CREATE OR REPLACE FUNCTION typing_game.fn_challenge_inbox_count()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT count(*)::int FROM typing_game.challenges x
  JOIN typing_game.challenge_players me ON me.challenge_id = x.id AND me.user_id = auth.uid()
  WHERE x.expires_at > now() AND (
    (x.opponent_id = auth.uid() AND x.status = 'pending')
    OR (x.status = 'accepted' AND x.mode = 'live')
    OR (x.status = 'accepted' AND x.mode = 'async' AND me.started_at IS NULL));
$$;
REVOKE ALL ON FUNCTION typing_game.fn_challenge_inbox_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_challenge_inbox_count() TO authenticated;
