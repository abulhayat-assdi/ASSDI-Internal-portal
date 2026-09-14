-- M1 0001: feature flags (launch-behind-flags strategy).
-- Full domain migrations (profiles, org, economy, clan, wars, seasons) land in M2/M4+.
-- This table is the runtime source of truth; env FEATURE_* values are build fallbacks only.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

-- org_id is nullable: NULL means "platform-wide default"; a non-null value
-- overrides the platform default for that one organization. The FK to
-- typing_game.organizations is added in 0002_identity_org.sql (deferred via
-- ALTER TABLE) because that table does not exist yet at this point in the
-- migration chain.
create table if not exists typing_game.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  org_id uuid,
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now()
);

-- NULL org_id defeats a plain UNIQUE, so guard the global vs. per-org
-- uniqueness separately (same pattern as user_roles_global_uniq in 0002).
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_global_uniq
  ON typing_game.feature_flags (key) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_org_uniq
  ON typing_game.feature_flags (key, org_id) WHERE org_id IS NOT NULL;

insert into typing_game.feature_flags (key, enabled, description) values
  ('PHASE_1_CORE', true, 'Core adventure + learning platform'),
  ('PHASE_2_ADAPTIVE', false, 'Adaptive learning + social play'),
  ('PHASE_2_REWARDED_ADS', false, 'Rewarded ads (flag OFF until provider eligibility confirmed)'),
  ('PHASE_3_CLAN_WARS', false, 'Cross-batch clan wars'),
  ('PHASE_3_SEASONS', false, 'Seasons + live events')
on conflict (key) where org_id is null do update set
  enabled = excluded.enabled,
  description = excluded.description;
