-- New professional ranks, a one-time progress reset, and daily goals.
--
-- 1. Backup, then reset: the redesigned typing area starts everyone from
--    zero XP, coins and level (agreed with the product owner, 2026-11-21).
--    Old totals and ledgers are copied to *_archive_2026_11 tables first,
--    so nothing is lost if it is ever needed. This file runs once (the
--    migration runner records it), so the reset never repeats.
-- 2. Ranks: 8 ranks x 5 tiers = 40 levels, XP needed = 25 * (level - 1)^2.
-- 3. Daily goal: each student picks minutes per day; typing time from
--    lessons, tests and practice is added per Bangladesh calendar day.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

-- ---------------------------------------------------------------- backup
CREATE TABLE IF NOT EXISTS typing_game.profiles_progress_archive_2026_11 AS
  SELECT id AS user_id, xp_total, coin_balance, current_level, now() AS archived_at
  FROM typing_game.profiles;
CREATE TABLE IF NOT EXISTS typing_game.xp_ledger_archive_2026_11 AS
  SELECT * FROM typing_game.xp_ledger;
CREATE TABLE IF NOT EXISTS typing_game.coin_ledger_archive_2026_11 AS
  SELECT * FROM typing_game.coin_ledger;
-- Archives are for admins only.
REVOKE ALL ON typing_game.profiles_progress_archive_2026_11 FROM PUBLIC;
REVOKE ALL ON typing_game.xp_ledger_archive_2026_11 FROM PUBLIC;
REVOKE ALL ON typing_game.coin_ledger_archive_2026_11 FROM PUBLIC;

-- ----------------------------------------------------------------- reset
DELETE FROM typing_game.xp_ledger;
DELETE FROM typing_game.coin_ledger;
UPDATE typing_game.profiles SET xp_total = 0, coin_balance = 0, current_level = 1;

-- ----------------------------------------------------------------- ranks
DELETE FROM typing_game.levels;
INSERT INTO typing_game.levels (level, required_xp, title_en, title_bn)
SELECT n,
       25 * (n - 1) * (n - 1),
       r.name || ' ' || (ARRAY['I', 'II', 'III', 'IV', 'V'])[((n - 1) % 5) + 1],
       r.name || ' ' || (ARRAY['I', 'II', 'III', 'IV', 'V'])[((n - 1) % 5) + 1]
FROM generate_series(1, 40) AS n
JOIN (VALUES
  (0, 'Trainee'), (1, 'Junior Typist'), (2, 'Typist'), (3, 'Senior Typist'),
  (4, 'Professional'), (5, 'Specialist'), (6, 'Expert'), (7, 'Master')
) AS r(idx, name) ON r.idx = (n - 1) / 5;

-- ------------------------------------------------------------ daily goal
CREATE TABLE IF NOT EXISTS typing_game.student_settings (
  user_id uuid PRIMARY KEY REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  daily_goal_minutes int NOT NULL DEFAULT 15 CHECK (daily_goal_minutes IN (5, 10, 15, 20, 30, 45, 60)),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE typing_game.student_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_settings_select_own ON typing_game.student_settings;
CREATE POLICY student_settings_select_own ON typing_game.student_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON typing_game.student_settings TO authenticated;

CREATE TABLE IF NOT EXISTS typing_game.daily_activity (
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  day date NOT NULL,
  typing_ms bigint NOT NULL DEFAULT 0 CHECK (typing_ms >= 0),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE typing_game.daily_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_activity_select_own ON typing_game.daily_activity;
CREATE POLICY daily_activity_select_own ON typing_game.daily_activity
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS daily_activity_select_staff ON typing_game.daily_activity;
CREATE POLICY daily_activity_select_staff ON typing_game.daily_activity
  FOR SELECT TO authenticated
  USING (typing_game.is_super_admin() OR typing_game.is_org_admin_of_user(user_id));
GRANT SELECT ON typing_game.daily_activity TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_set_daily_goal(p_minutes int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_minutes NOT IN (5, 10, 15, 20, 30, 45, 60) THEN RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = '22023'; END IF;
  INSERT INTO typing_game.student_settings (user_id, daily_goal_minutes) VALUES (v_me, p_minutes)
  ON CONFLICT (user_id) DO UPDATE SET daily_goal_minutes = EXCLUDED.daily_goal_minutes, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_set_daily_goal(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_set_daily_goal(int) TO authenticated;

-- Adds typing time to today (Bangladesh date). One call is capped at 1 hour.
CREATE OR REPLACE FUNCTION typing_game.fn_add_typing_time(p_ms int) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_day date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  v_total bigint;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_ms IS NULL OR p_ms <= 0 THEN RETURN 0; END IF;
  INSERT INTO typing_game.daily_activity (user_id, day, typing_ms)
  VALUES (v_me, v_day, LEAST(p_ms, 3600000))
  ON CONFLICT (user_id, day) DO UPDATE SET typing_ms = typing_game.daily_activity.typing_ms + LEAST(p_ms, 3600000)
  RETURNING typing_ms INTO v_total;
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_add_typing_time(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_add_typing_time(int) TO authenticated;
