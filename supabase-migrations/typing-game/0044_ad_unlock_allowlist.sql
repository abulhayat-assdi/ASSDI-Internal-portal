-- 0044: fn_ad_unlock_game — server-side allowlist.
--
-- The API route re-validates AD_UNLOCKABLE_GAME_SLUGS before calling this,
-- but SECURITY DEFINER functions are callable directly by any authenticated
-- role with EXECUTE, so a scripted client could otherwise unlock ANY active
-- game (including late-world content) by invoking the RPC directly. This
-- moves the eligibility list into the function itself as defense in depth:
-- the curated list must match content/access-overrides.ts
-- (AD_UNLOCKABLE_GAME_SLUGS). To retune, update BOTH files together.

CREATE OR REPLACE FUNCTION typing_game.fn_ad_unlock_game(p_game_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_game_slug NOT IN ('word-ninja', 'minute-dash', 'sentence-run') THEN
    RAISE EXCEPTION 'not ad-unlockable: %', p_game_slug;
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
