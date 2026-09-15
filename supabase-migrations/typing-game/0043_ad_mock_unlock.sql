-- 0043: fn_ad_unlock_game — mock "watch an ad to unlock" write path.
--
-- game_unlocks has no INSERT/UPDATE policy for any API role (0008:
-- "everything earned is owner-readable, function-written"), so this needs a
-- SECURITY DEFINER function, same shape as fn_process_progression (0009).
-- ON CONFLICT DO NOTHING mirrors that function's own convention: a
-- manually-granted unlock here is never clobbered by the normal progression
-- function later, and a real rule-based unlock recorded first is never
-- downgraded by this one. The curated eligibility list (which games this
-- applies to) lives in application code (content/access-overrides.ts) and
-- is re-validated by the API route before this is ever called — this
-- function only guards that the game itself exists and is active.

CREATE OR REPLACE FUNCTION typing_game.fn_ad_unlock_game(p_game_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM typing_game.games WHERE slug = p_game_slug AND is_active
  ) THEN
    RAISE EXCEPTION 'unknown or inactive game: %', p_game_slug;
  END IF;

  INSERT INTO typing_game.game_unlocks (user_id, game_slug, unlocked, reason)
  VALUES (v_user_id, p_game_slug, true, jsonb_build_object('type', 'ad_mock'))
  ON CONFLICT (user_id, game_slug) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_ad_unlock_game(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_ad_unlock_game(text) TO authenticated;
