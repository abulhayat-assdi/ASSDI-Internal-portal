-- Arcade games (the new Games page). Eight challenging typing games; only
-- the first is open, every other game is unlocked by the student at any
-- time with coins or a rewarded ad (ads off = the ad path unlocks directly).
--
-- Scores are never taken from the browser: the browser sends only its key
-- log, the Node route replays the deterministic game simulation from the
-- session seed and saves the numbers it computed here. The duration is also
-- bounded by the server clock below.
--
-- The 38 old games stay in the database (teacher missions still use them);
-- they are simply no longer listed on the Games page.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE TABLE IF NOT EXISTS typing_game.arcade_games (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  price int NOT NULL CHECK (price >= 0),
  points_per_coin int NOT NULL CHECK (points_per_coin > 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE typing_game.arcade_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arcade_games_read ON typing_game.arcade_games;
CREATE POLICY arcade_games_read ON typing_game.arcade_games FOR SELECT TO authenticated USING (true);
GRANT SELECT ON typing_game.arcade_games TO authenticated;

INSERT INTO typing_game.arcade_games (slug, price, points_per_coin, sort_order) VALUES
  ('meteor-shield', 0, 1200, 1),
  ('bubble-burst', 100, 650, 2),
  ('runner-rush', 120, 1200, 3),
  ('turbo-racer', 150, 260, 4),
  ('combo-blitz', 150, 55, 5),
  ('bomb-squad', 200, 1200, 6),
  ('lava-climb', 250, 340, 7),
  ('dragon-keep', 300, 480, 8)
ON CONFLICT (slug) DO UPDATE SET
  price = EXCLUDED.price, points_per_coin = EXCLUDED.points_per_coin, sort_order = EXCLUDED.sort_order;

-- Rewarded ads per game unlock (used only once the super-admin turns ads on).
UPDATE typing_game.ad_settings
SET action_views = action_views || '{"game_unlock": 2}'::jsonb
WHERE NOT (action_views ? 'game_unlock');
ALTER TABLE typing_game.ad_settings ALTER COLUMN action_views SET DEFAULT
  '{"lesson_skip": 2, "lesson_continue_after_fail": 1, "double_xp": 1, "streak_restore": 1, "game_unlock": 2}'::jsonb;

CREATE TABLE IF NOT EXISTS typing_game.arcade_unlocks (
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  game_slug text NOT NULL REFERENCES typing_game.arcade_games (slug),
  method text NOT NULL CHECK (method IN ('coins', 'ad')),
  coins_spent int NOT NULL DEFAULT 0 CHECK (coins_spent >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug)
);
ALTER TABLE typing_game.arcade_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arcade_unlocks_own ON typing_game.arcade_unlocks;
CREATE POLICY arcade_unlocks_own ON typing_game.arcade_unlocks FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON typing_game.arcade_unlocks TO authenticated;

CREATE TABLE IF NOT EXISTS typing_game.arcade_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  game_slug text NOT NULL REFERENCES typing_game.arcade_games (slug),
  seed int NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'finished')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  score int,
  level int,
  wpm numeric(6, 2),
  accuracy numeric(5, 2),
  correct_chars int,
  wrong_chars int,
  duration_ms int,
  won boolean,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS arcade_sessions_user_idx ON typing_game.arcade_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS arcade_sessions_best_idx ON typing_game.arcade_sessions (game_slug, score DESC) WHERE status = 'finished';

ALTER TABLE typing_game.arcade_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arcade_sessions_own ON typing_game.arcade_sessions;
CREATE POLICY arcade_sessions_own ON typing_game.arcade_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS arcade_sessions_staff ON typing_game.arcade_sessions;
CREATE POLICY arcade_sessions_staff ON typing_game.arcade_sessions FOR SELECT TO authenticated
  USING (typing_game.is_super_admin() OR typing_game.is_org_admin_of_user(user_id));
GRANT SELECT ON typing_game.arcade_sessions TO authenticated;

-- Unlock a game for the calling student. 'coins' pays the price from the
-- coin balance; 'ad' is used by the route after the rewarded-ad gate passed
-- (with ads off the gate is free). Unlocking twice is a no-op.
CREATE OR REPLACE FUNCTION typing_game.fn_arcade_unlock(p_slug text, p_method text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_price int;
  v_balance int;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_method NOT IN ('coins', 'ad') THEN RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023'; END IF;
  SELECT price INTO v_price FROM typing_game.arcade_games WHERE slug = p_slug AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_price = 0 OR EXISTS (SELECT 1 FROM typing_game.arcade_unlocks WHERE user_id = v_me AND game_slug = p_slug) THEN
    SELECT coin_balance INTO v_balance FROM typing_game.profiles WHERE id = v_me;
    RETURN jsonb_build_object('unlocked', true, 'coins_spent', 0, 'balance', COALESCE(v_balance, 0));
  END IF;

  SELECT coin_balance INTO v_balance FROM typing_game.profiles
  WHERE id = v_me AND account_status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

  IF p_method = 'coins' THEN
    IF v_balance < v_price THEN
      RAISE EXCEPTION 'NOT_ENOUGH_COINS' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO typing_game.coin_ledger
      (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
    VALUES (v_me, -v_price, 'arcade_unlock', 'arcade', p_slug, 'game unlock',
            jsonb_build_object('game', p_slug), v_balance - v_price);
    UPDATE typing_game.profiles SET coin_balance = v_balance - v_price WHERE id = v_me;
    v_balance := v_balance - v_price;
  END IF;

  INSERT INTO typing_game.arcade_unlocks (user_id, game_slug, method, coins_spent)
  VALUES (v_me, p_slug, p_method, CASE WHEN p_method = 'coins' THEN v_price ELSE 0 END);
  RETURN jsonb_build_object('unlocked', true,
    'coins_spent', CASE WHEN p_method = 'coins' THEN v_price ELSE 0 END, 'balance', v_balance);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_arcade_unlock(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_arcade_unlock(text, text) TO authenticated;

-- Opens a run of an unlocked game; returns the session id and its seed.
CREATE OR REPLACE FUNCTION typing_game.fn_arcade_start(p_slug text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_price int;
  v_id uuid;
  v_seed int := floor(random() * 2147483646)::int + 1;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM typing_game.profiles WHERE id = v_me AND account_status = 'active') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT price INTO v_price FROM typing_game.arcade_games WHERE slug = p_slug AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_price > 0 AND NOT EXISTS (SELECT 1 FROM typing_game.arcade_unlocks WHERE user_id = v_me AND game_slug = p_slug) THEN
    RAISE EXCEPTION 'LOCKED' USING ERRCODE = '42501';
  END IF;
  DELETE FROM typing_game.arcade_sessions
  WHERE user_id = v_me AND status = 'started' AND started_at < now() - interval '1 day';
  INSERT INTO typing_game.arcade_sessions (user_id, game_slug, seed)
  VALUES (v_me, p_slug, v_seed) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'seed', v_seed);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_arcade_start(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_arcade_start(text) TO authenticated;

-- Saves a run the route has replayed, and pays XP and coins. Rewards need a
-- real run (15 s and 20 correct characters) and stop after 40 runs a day.
CREATE OR REPLACE FUNCTION typing_game.fn_arcade_finish(
  p_session uuid, p_score int, p_level int, p_wpm numeric, p_accuracy numeric,
  p_correct int, p_wrong int, p_duration_ms int, p_won boolean, p_stats jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_s typing_game.arcade_sessions%ROWTYPE;
  v_ppc int;
  v_prev_best int;
  v_today int;
  v_coins int := 0;
  v_xp int := 0;
  v_prof record;
  v_ref text := 'arcade:' || p_session::text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_score < 0 OR p_score > 10000000 OR p_level < 0 OR p_level > 1000
     OR p_wpm < 0 OR p_wpm > 300 OR p_accuracy < 0 OR p_accuracy > 100
     OR p_correct < 0 OR p_wrong < 0 OR p_duration_ms < 0 THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_s FROM typing_game.arcade_sessions
  WHERE id = p_session AND user_id = v_me AND status = 'started' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  -- The game cannot have run longer than the session has existed.
  IF p_duration_ms > extract(epoch FROM (now() - v_s.started_at)) * 1000 + 5000 THEN
    RAISE EXCEPTION 'TOO_LONG' USING ERRCODE = '22023';
  END IF;

  SELECT points_per_coin INTO v_ppc FROM typing_game.arcade_games WHERE slug = v_s.game_slug;
  SELECT max(score) INTO v_prev_best FROM typing_game.arcade_sessions
  WHERE user_id = v_me AND game_slug = v_s.game_slug AND status = 'finished';
  SELECT count(*) INTO v_today FROM typing_game.arcade_sessions
  WHERE user_id = v_me AND status = 'finished' AND finished_at >= date_trunc('day', now());

  IF v_today < 40 AND p_duration_ms >= 15000 AND p_correct >= 20 THEN
    v_coins := least(40, 2 + p_score / v_ppc);
    v_xp := least(50, 5 + v_coins);
    IF v_prev_best IS NULL OR p_score > v_prev_best THEN v_coins := v_coins + 5; END IF;
  END IF;

  UPDATE typing_game.arcade_sessions SET
    status = 'finished', finished_at = now(), score = p_score, level = p_level, wpm = p_wpm,
    accuracy = p_accuracy, correct_chars = p_correct, wrong_chars = p_wrong,
    duration_ms = p_duration_ms, won = p_won, stats = COALESCE(p_stats, '{}'::jsonb),
    xp = v_xp, coins = v_coins
  WHERE id = p_session;

  IF v_xp > 0 OR v_coins > 0 THEN
    SELECT xp_total, coin_balance INTO v_prof FROM typing_game.profiles WHERE id = v_me FOR UPDATE;
    IF v_xp > 0 THEN
      INSERT INTO typing_game.xp_ledger
        (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
      VALUES (v_me, v_xp, 'arcade', 'arcade', v_ref, 'arcade game',
              jsonb_build_object('game', v_s.game_slug, 'score', p_score,
                                 'personal_best', v_prev_best IS NULL OR p_score > v_prev_best),
              v_prof.xp_total + v_xp);
    END IF;
    IF v_coins > 0 THEN
      INSERT INTO typing_game.coin_ledger
        (user_id, amount, source, source_type, reference_id, reason, metadata, balance_after)
      VALUES (v_me, v_coins, 'arcade', 'arcade', v_ref, 'arcade game',
              jsonb_build_object('game', v_s.game_slug, 'score', p_score), v_prof.coin_balance + v_coins);
    END IF;
    UPDATE typing_game.profiles SET
      xp_total = v_prof.xp_total + v_xp,
      coin_balance = v_prof.coin_balance + v_coins,
      current_level = COALESCE(
        (SELECT max(level) FROM typing_game.levels WHERE required_xp <= v_prof.xp_total + v_xp), current_level)
    WHERE id = v_me;
  END IF;

  RETURN jsonb_build_object('xp', v_xp, 'coins', v_coins, 'best', greatest(COALESCE(v_prev_best, 0), p_score),
                            'new_best', v_prev_best IS NULL OR p_score > v_prev_best);
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_arcade_finish(uuid, int, int, numeric, numeric, int, int, int, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_arcade_finish(uuid, int, int, numeric, numeric, int, int, int, boolean, jsonb) TO authenticated;
