-- Ads for the typing area: Google display slots plus rewarded ads that pay
-- for actions (skip a lesson, continue after a failed assessment, ...).
-- Everything ships OFF: with ads off, every ad-gated action completes
-- directly. Only the platform super-admin can change the settings.
--
-- Rewarded views are counted server-side: a view must be started, then
-- completed no sooner than the minimum watch time, and is consumed by the
-- action it paid for. The older item-reward tables (0035/0036) are unused.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE TABLE IF NOT EXISTS typing_game.ad_settings (
  id int PRIMARY KEY DEFAULT 0 CHECK (id = 0),
  enabled boolean NOT NULL DEFAULT false,
  display_enabled boolean NOT NULL DEFAULT false,
  rewarded_enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'google')),
  publisher_id text NOT NULL DEFAULT '' CHECK (publisher_id ~ '^(ca-pub-[0-9]{6,20})?$'),
  -- slot key -> { "enabled": bool, "slotId": "1234567890" }
  slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- action -> rewarded views required (0 = the action is free)
  action_views jsonb NOT NULL DEFAULT
    '{"lesson_skip": 2, "lesson_continue_after_fail": 1, "double_xp": 1, "streak_restore": 1}'::jsonb,
  rewarded_daily_limit int NOT NULL DEFAULT 10 CHECK (rewarded_daily_limit BETWEEN 0 AND 100),
  min_watch_seconds int NOT NULL DEFAULT 15 CHECK (min_watch_seconds BETWEEN 5 AND 120),
  -- When no ad can be shown (no fill / blocker): 'allow' lets the action through, 'block' refuses it.
  no_fill text NOT NULL DEFAULT 'allow' CHECK (no_fill IN ('allow', 'block')),
  exempt_batch_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO typing_game.ad_settings (id) VALUES (0) ON CONFLICT (id) DO NOTHING;

ALTER TABLE typing_game.ad_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ad_settings_select ON typing_game.ad_settings;
CREATE POLICY ad_settings_select ON typing_game.ad_settings FOR SELECT TO authenticated USING (true);
GRANT SELECT ON typing_game.ad_settings TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_update_ad_settings(p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
BEGIN
  IF NOT typing_game.is_super_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  UPDATE typing_game.ad_settings SET
    enabled = COALESCE((p->>'enabled')::boolean, enabled),
    display_enabled = COALESCE((p->>'display_enabled')::boolean, display_enabled),
    rewarded_enabled = COALESCE((p->>'rewarded_enabled')::boolean, rewarded_enabled),
    provider = COALESCE(p->>'provider', provider),
    publisher_id = COALESCE(p->>'publisher_id', publisher_id),
    slots = COALESCE(p->'slots', slots),
    action_views = COALESCE(p->'action_views', action_views),
    rewarded_daily_limit = COALESCE((p->>'rewarded_daily_limit')::int, rewarded_daily_limit),
    min_watch_seconds = COALESCE((p->>'min_watch_seconds')::int, min_watch_seconds),
    no_fill = COALESCE(p->>'no_fill', no_fill),
    exempt_batch_ids = COALESCE(
      (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(p->'exempt_batch_ids') x),
      CASE WHEN p ? 'exempt_batch_ids' THEN '{}'::uuid[] ELSE exempt_batch_ids END),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 0;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_update_ad_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_update_ad_settings(jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS typing_game.ad_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action ~ '^[a-z_]{2,40}$'),
  target text NOT NULL DEFAULT '' CHECK (length(target) <= 80),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'consumed')),
  no_fill boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ad_views_user_idx ON typing_game.ad_views (user_id, action, target, status);

ALTER TABLE typing_game.ad_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ad_views_select_own ON typing_game.ad_views;
CREATE POLICY ad_views_select_own ON typing_game.ad_views FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS ad_views_select_admin ON typing_game.ad_views;
CREATE POLICY ad_views_select_admin ON typing_game.ad_views FOR SELECT TO authenticated USING (typing_game.is_super_admin());
GRANT SELECT ON typing_game.ad_views TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_ad_view_start(p_action text, p_target text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_s typing_game.ad_settings%ROWTYPE;
  v_today int;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_s FROM typing_game.ad_settings WHERE id = 0;
  IF NOT (v_s.enabled AND v_s.rewarded_enabled) THEN RAISE EXCEPTION 'ADS_OFF' USING ERRCODE = 'P0001'; END IF;
  SELECT count(*) INTO v_today FROM typing_game.ad_views
  WHERE user_id = v_me AND status <> 'started' AND completed_at >= date_trunc('day', now());
  IF v_today >= v_s.rewarded_daily_limit THEN RAISE EXCEPTION 'DAILY_LIMIT' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO typing_game.ad_views (user_id, action, target) VALUES (v_me, p_action, COALESCE(p_target, ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_ad_view_start(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_ad_view_start(text, text) TO authenticated;

-- Completes a started view once the minimum watch time has passed on the
-- SERVER clock. A no-fill completion is only accepted when policy allows it.
CREATE OR REPLACE FUNCTION typing_game.fn_ad_view_complete(p_view uuid, p_no_fill boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_s typing_game.ad_settings%ROWTYPE;
  v_v typing_game.ad_views%ROWTYPE;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_s FROM typing_game.ad_settings WHERE id = 0;
  SELECT * INTO v_v FROM typing_game.ad_views WHERE id = p_view AND user_id = v_me FOR UPDATE;
  IF NOT FOUND OR v_v.status <> 'started' THEN RETURN false; END IF;
  IF p_no_fill AND v_s.no_fill <> 'allow' THEN RETURN false; END IF;
  IF NOT p_no_fill AND now() - v_v.started_at < make_interval(secs => v_s.min_watch_seconds) THEN RETURN false; END IF;
  UPDATE typing_game.ad_views SET status = 'completed', completed_at = now(), no_fill = p_no_fill WHERE id = p_view;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_ad_view_complete(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_ad_view_complete(uuid, boolean) TO authenticated;

-- Spends `p_count` completed views for (action, target). True when there were enough.
CREATE OR REPLACE FUNCTION typing_game.fn_ad_views_consume(p_action text, p_target text, p_count int) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_ids uuid[];
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_count <= 0 THEN RETURN true; END IF;
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM typing_game.ad_views
    WHERE user_id = v_me AND action = p_action AND target = COALESCE(p_target, '') AND status = 'completed'
    ORDER BY completed_at LIMIT p_count FOR UPDATE
  ) s;
  IF COALESCE(array_length(v_ids, 1), 0) < p_count THEN RETURN false; END IF;
  UPDATE typing_game.ad_views SET status = 'consumed', consumed_at = now() WHERE id = ANY (v_ids);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_ad_views_consume(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_ad_views_consume(text, text, int) TO authenticated;
