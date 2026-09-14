-- M18 0038: evidenced index additions (no blind indexes).
--
-- Audit method: 5k-row volume + EXPLAIN ANALYZE per hot path.
-- Verified already-covered (PK/UNIQUE leading columns or dedicated
-- indexes): game_attempts(user), ledgers(user), season boards,
-- war aggregates (UNIQUE war,user bitmap), mission instances(user),
-- clan memberships (partial active-user index), adaptive/shop/ads
-- user indexes, tournament round/match joins.
--
-- Gap found: competition_entries WHERE user_id (dashboard "my
-- competitions" + entries_select_own RLS) Seq-scanned 5k rows.
CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

CREATE INDEX IF NOT EXISTS entries_user_idx
  ON typing_game.competition_entries (user_id);
