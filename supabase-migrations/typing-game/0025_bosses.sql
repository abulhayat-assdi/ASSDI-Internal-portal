-- M12 clan bosses: cooperative PvE raids. Clan members' validated M4
-- attempts deal data-driven damage to shared boss HP; phases, defeat and
-- rewards are server-authoritative. No second attempt engine, no boss
-- currency, no clan-XP mutation (ordinary attempts still mint exactly one
-- clan_contributions row via the M10 trigger; boss damage is tracked
-- separately in boss_damage_events).

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

DO $$ BEGIN
  CREATE TYPE typing_game.boss_status AS ENUM ('draft', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typing_game.boss_instance_status AS ENUM (
    'draft', 'scheduled', 'active', 'defeated', 'expired', 'cancelled',
    'processing', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS typing_game.boss_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  lore text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'normal'
    CHECK (difficulty IN ('easy', 'normal', 'hard', 'nightmare')),
  world_id text,
  max_hp bigint NOT NULL CHECK (max_hp > 0),
  status typing_game.boss_status NOT NULL DEFAULT 'draft',
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Damage profile (data-driven; see docs/clan-boss-damage.md):
  -- {formula: 'score_x_mult' | 'wpm_x_acc', multiplier, accuracy_factor}
  scoring_profile jsonb NOT NULL DEFAULT
    '{"formula": "score_x_mult", "multiplier": 1}'::jsonb,
  reward_profile jsonb NOT NULL DEFAULT
    '{"participation_xp": 20, "participation_coins": 2, "defeat_xp": 100, "defeat_coins": 10, "apply_on_expire": true}'::jsonb,
  eligible jsonb NOT NULL DEFAULT '{"min_level": 1}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  preview_key text,
  banner_key text,
  art_key text,
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS typing_game.boss_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id uuid NOT NULL REFERENCES typing_game.boss_definitions (id)
    ON DELETE CASCADE,
  version int NOT NULL,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (boss_id, version)
);

-- Phases are HP bands: phase covers (hp_to, hp_from]. Position 0 is the
-- opening phase (hp_from = max_hp). Gaps/overlaps rejected at write time.
CREATE TABLE IF NOT EXISTS typing_game.boss_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id uuid NOT NULL REFERENCES typing_game.boss_definitions (id)
    ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 0),
  name text NOT NULL DEFAULT '',
  hp_from bigint NOT NULL CHECK (hp_from > 0),
  hp_to bigint NOT NULL CHECK (hp_to >= 0),
  game_constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  damage_multiplier numeric NOT NULL DEFAULT 1 CHECK (damage_multiplier > 0),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (hp_from > hp_to),
  UNIQUE (boss_id, position)
);

-- One clan's battle against one boss.
CREATE TABLE IF NOT EXISTS typing_game.boss_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id uuid NOT NULL REFERENCES typing_game.boss_definitions (id)
    ON DELETE CASCADE,
  clan_id uuid NOT NULL REFERENCES typing_game.clans (id) ON DELETE CASCADE,
  status typing_game.boss_instance_status NOT NULL DEFAULT 'draft',
  start_at timestamptz,
  end_at timestamptz,
  initial_hp bigint NOT NULL CHECK (initial_hp > 0),
  current_hp bigint NOT NULL CHECK (current_hp >= 0),
  current_phase int NOT NULL DEFAULT 0,
  attempts_per_member int NOT NULL DEFAULT 10 CHECK (attempts_per_member > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  defeated_at timestamptz,
  finalized_at timestamptz,
  UNIQUE (boss_id, clan_id, start_at)
);
CREATE INDEX IF NOT EXISTS boss_instances_clan_idx
  ON typing_game.boss_instances (clan_id);

CREATE TABLE IF NOT EXISTS typing_game.boss_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  eligible boolean NOT NULL DEFAULT true,
  eligibility_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  damage bigint NOT NULL DEFAULT 0 CHECK (damage >= 0),
  attempts_used int NOT NULL DEFAULT 0 CHECK (attempts_used >= 0),
  UNIQUE (instance_id, user_id)
);

-- Effective pool, resolved from phase constraints at activation.
CREATE TABLE IF NOT EXISTS typing_game.boss_games (
  instance_id uuid NOT NULL REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES typing_game.games (id) ON DELETE RESTRICT,
  PRIMARY KEY (instance_id, game_id)
);

-- One validated attempt deals damage exactly once (UNIQUE attempt_id).
CREATE TABLE IF NOT EXISTS typing_game.boss_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  attempt_id uuid UNIQUE NOT NULL REFERENCES typing_game.game_attempts (id)
    ON DELETE CASCADE,
  damage bigint NOT NULL CHECK (damage >= 0),
  phase int NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS boss_attempts_instance_idx
  ON typing_game.boss_attempts (instance_id);

CREATE TABLE IF NOT EXISTS typing_game.boss_damage_events (
  key text PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES typing_game.game_attempts (id)
    ON DELETE CASCADE,
  damage bigint NOT NULL CHECK (damage >= 0),
  phase int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS typing_game.boss_phase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  from_phase int NOT NULL,
  to_phase int NOT NULL,
  hp_remaining bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS typing_game.boss_results (
  instance_id uuid PRIMARY KEY REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  total_damage bigint NOT NULL DEFAULT 0,
  contributors int NOT NULL DEFAULT 0,
  top_user_id uuid REFERENCES typing_game.profiles (id) ON DELETE SET NULL,
  top_damage bigint NOT NULL DEFAULT 0,
  outcome text NOT NULL CHECK (outcome IN ('defeated', 'expired'))
);

CREATE TABLE IF NOT EXISTS typing_game.boss_reward_events (
  key text PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES typing_game.boss_instances (id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('participation', 'defeat')),
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Viewer predicate: the instance clan's viewers (members, batch teachers,
-- mission admins/super, org admins) via the M10 rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_is_boss_viewer(p_instance uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT typing_game.fn_is_clan_viewer(
    (SELECT clan_id FROM typing_game.boss_instances WHERE id = p_instance));
$$;

-- ---------------------------------------------------------------------------
-- RLS: boss-visible reads; all writes via SECURITY DEFINER fns.
-- ---------------------------------------------------------------------------
ALTER TABLE typing_game.boss_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_damage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_phase_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.boss_reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY boss_defs_select ON typing_game.boss_definitions
  FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY boss_defs_admin ON typing_game.boss_definitions
  FOR SELECT TO authenticated
  USING (typing_game.fn_is_mission_admin() OR typing_game.is_super_admin());

CREATE POLICY boss_versions_select ON typing_game.boss_versions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM typing_game.boss_definitions d
      WHERE d.id = boss_versions.boss_id
        AND (d.status = 'active'
          OR typing_game.fn_is_mission_admin() OR typing_game.is_super_admin())));

CREATE POLICY boss_phases_select ON typing_game.boss_phases
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM typing_game.boss_definitions d
      WHERE d.id = boss_phases.boss_id
        AND (d.status = 'active'
          OR typing_game.fn_is_mission_admin() OR typing_game.is_super_admin())));

CREATE POLICY boss_instances_select ON typing_game.boss_instances
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(id));
CREATE POLICY boss_parts_select ON typing_game.boss_participants
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(instance_id));
CREATE POLICY boss_games_select ON typing_game.boss_games
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(instance_id));
CREATE POLICY boss_attempts_select ON typing_game.boss_attempts
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(instance_id));
CREATE POLICY boss_damage_select ON typing_game.boss_damage_events
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(instance_id));
CREATE POLICY boss_phase_ev_select ON typing_game.boss_phase_events
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(instance_id));
CREATE POLICY boss_results_select ON typing_game.boss_results
  FOR SELECT TO authenticated USING (typing_game.fn_is_boss_viewer(instance_id));
CREATE POLICY boss_rewards_select ON typing_game.boss_reward_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM typing_game.boss_instances i
               WHERE i.id = boss_reward_events.instance_id
                 AND typing_game.fn_can_manage_clan(i.clan_id)));
