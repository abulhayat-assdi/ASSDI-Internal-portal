-- M8 0013: competition schema, RLS, and management functions.
-- Companion: 0014 (entry/attach/finalize/adjust functions).
-- Future types (CLAN, CLAN_WAR, TOURNAMENT, RELAY, SEASONAL) are accepted by
-- the type enum today; their mechanics land later without schema changes.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

DO $$ BEGIN
  CREATE TYPE typing_game.competition_status AS ENUM (
    'draft', 'scheduled', 'registration_open', 'registration_closed',
    'live', 'ended', 'processing', 'finalized', 'cancelled', 'paused'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typing_game.competition_type AS ENUM (
    'SOLO', 'BATCH', 'TIMED', 'SCORE_ATTACK', 'ACCURACY', 'SPEED',
    'ENDURANCE', 'MULTI_ROUND', 'CLAN', 'CLAN_WAR', 'TOURNAMENT', 'RELAY',
    'SEASONAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS typing_game.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  type typing_game.competition_type NOT NULL,
  visibility text NOT NULL DEFAULT 'batch'
    CHECK (visibility IN ('public', 'organization', 'batch')),
  organizer_id uuid REFERENCES typing_game.profiles (id) ON DELETE SET NULL,
  status typing_game.competition_status NOT NULL DEFAULT 'draft',
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring jsonb NOT NULL DEFAULT '{"metric":"score"}'::jsonb,
  tie_breakers text[] NOT NULL DEFAULT ARRAY['score','accuracy','wpm','errors','earliest'],
  attempt_policy text NOT NULL DEFAULT 'BEST_SCORE'
    CHECK (attempt_policy IN (
      'BEST_SCORE', 'BEST_ACCURACY', 'BEST_WPM', 'LATEST_VALID', 'AVERAGE_TOP_3')),
  attempt_limit int NOT NULL DEFAULT 5 CHECK (attempt_limit > 0),
  aggregate_strategy text
    CHECK (aggregate_strategy IS NULL OR aggregate_strategy IN (
      'SUM', 'AVERAGE', 'TOP_N', 'AVERAGE_TOP_N', 'BEST_PLAYER',
      'PARTICIPATION_WEIGHTED')),
  aggregate_n int CHECK (aggregate_n IS NULL OR aggregate_n > 0),
  reward_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  registration_starts_at timestamptz,
  registration_ends_at timestamptz,
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    registration_starts_at IS NULL OR registration_ends_at IS NULL
    OR registration_ends_at > registration_starts_at
  )
);
CREATE INDEX IF NOT EXISTS competitions_status_idx ON typing_game.competitions (status);
CREATE INDEX IF NOT EXISTS competitions_window_idx
  ON typing_game.competitions (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS typing_game.competition_games (
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES typing_game.games (id) ON DELETE RESTRICT,
  game_version_id uuid REFERENCES typing_game.game_versions (id) ON DELETE RESTRICT,
  PRIMARY KEY (competition_id, game_id)
);

CREATE TABLE IF NOT EXISTS typing_game.competition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES typing_game.batches (id) ON DELETE RESTRICT,
  skill_band text,
  status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'withdrawn', 'disqualified')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, user_id)
);
CREATE INDEX IF NOT EXISTS entries_comp_idx ON typing_game.competition_entries (competition_id);

CREATE TABLE IF NOT EXISTS typing_game.competition_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES typing_game.competition_entries (id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES typing_game.game_attempts (id) ON DELETE RESTRICT
    UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comp_attempts_entry_idx
  ON typing_game.competition_attempts (competition_id, entry_id);

CREATE TABLE IF NOT EXISTS typing_game.competition_results (
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('participant', 'batch')),
  ref_id uuid NOT NULL,
  rank int NOT NULL CHECK (rank > 0),
  score numeric NOT NULL,
  accuracy numeric NOT NULL DEFAULT 0,
  wpm numeric NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competition_id, scope, ref_id)
);

CREATE TABLE IF NOT EXISTS typing_game.competition_reward_events (
  key text PRIMARY KEY,
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES typing_game.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS typing_game.competition_state_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES typing_game.profiles (id) ON DELETE SET NULL,
  from_status typing_game.competition_status,
  to_status typing_game.competition_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS state_events_comp_idx
  ON typing_game.competition_state_events (competition_id);

CREATE TABLE IF NOT EXISTS typing_game.competition_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES typing_game.competitions (id) ON DELETE CASCADE,
  scope text NOT NULL,
  ref_id uuid NOT NULL,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  reason text NOT NULL,
  actor_user_id uuid REFERENCES typing_game.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION typing_game.course_organization_id(p_course_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT organization_id FROM typing_game.courses WHERE id = p_course_id;
$$;

REVOKE ALL ON FUNCTION typing_game.course_organization_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.course_organization_id(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Management gate (used by RLS + all privileged functions): super_admin, or
-- an admin covering every scoped org, or a teacher covering every scoped
-- batch/course. Scopeless competitions are super-admin only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_can_manage_competition(p_competition uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_elig jsonb;
  v_batches uuid[];
  v_courses uuid[];
BEGIN
  IF v_me IS NULL THEN
    RETURN false;
  END IF;
  IF typing_game.is_super_admin() THEN
    RETURN true;
  END IF;
  SELECT eligibility INTO v_elig
  FROM typing_game.competitions WHERE id = p_competition;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x::uuid), '{}') INTO v_batches
  FROM jsonb_array_elements_text(COALESCE(v_elig -> 'batches', '[]'::jsonb)) AS x
  WHERE x ~ '^[0-9a-fA-F-]{36}$';
  SELECT COALESCE(array_agg(DISTINCT x::uuid), '{}') INTO v_courses
  FROM jsonb_array_elements_text(COALESCE(v_elig -> 'courses', '[]'::jsonb)) AS x
  WHERE x ~ '^[0-9a-fA-F-]{36}$';

  IF v_batches = '{}' AND v_courses = '{}' THEN
    RETURN false;
  END IF;

  IF v_batches <> '{}' THEN
    IF NOT EXISTS (
      SELECT 1 FROM unnest(v_batches) AS b
      WHERE NOT typing_game.is_org_admin(typing_game.batch_organization_id(b))
    ) THEN
      RETURN true;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM unnest(v_batches) AS b
      WHERE NOT typing_game.is_teacher_of_batch(b)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF v_courses <> '{}' THEN
    IF NOT EXISTS (
      SELECT 1 FROM unnest(v_courses) AS c
      WHERE NOT typing_game.is_org_admin(typing_game.course_organization_id(c))
    ) THEN
      RETURN true;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM unnest(v_courses) AS c
      WHERE NOT EXISTS (
        SELECT 1 FROM typing_game.teacher_assignments ta
        WHERE ta.user_id = v_me AND ta.course_id = c
      )
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_can_manage_competition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_can_manage_competition(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: students read non-draft competitions + own entries/attempts + their
-- rows once finalized; everything privileged flows through functions.
-- ---------------------------------------------------------------------------
ALTER TABLE typing_game.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_reward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_game.competition_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY competitions_select_public ON typing_game.competitions
  FOR SELECT TO anon
  USING (visibility = 'public' AND status <> 'draft');

CREATE POLICY competitions_select_app ON typing_game.competitions
  FOR SELECT TO authenticated
  USING (
    status <> 'draft'
    OR typing_game.fn_can_manage_competition(id)
  );

CREATE POLICY competition_games_select ON typing_game.competition_games
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY entries_select_own ON typing_game.competition_entries
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY entries_select_manager ON typing_game.competition_entries
  FOR SELECT TO authenticated USING (typing_game.fn_can_manage_competition(competition_id));

CREATE POLICY attempts_select_own ON typing_game.competition_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM typing_game.competition_entries e
      WHERE e.id = competition_attempts.entry_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY attempts_select_manager ON typing_game.competition_attempts
  FOR SELECT TO authenticated USING (typing_game.fn_can_manage_competition(competition_id));

CREATE POLICY results_select_final ON typing_game.competition_results
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM typing_game.competitions c
      WHERE c.id = competition_results.competition_id AND c.status = 'finalized'
    )
  );

CREATE POLICY results_select_scoped ON typing_game.competition_results
  FOR SELECT TO authenticated
  USING (
    typing_game.fn_can_manage_competition(competition_id)
    OR (scope = 'participant' AND ref_id = auth.uid())
  );

CREATE POLICY reward_events_select_own ON typing_game.competition_reward_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY reward_events_select_manager ON typing_game.competition_reward_events
  FOR SELECT TO authenticated USING (typing_game.fn_can_manage_competition(competition_id));

CREATE POLICY state_events_select_scoped ON typing_game.competition_state_events
  FOR SELECT TO authenticated
  USING (
    typing_game.fn_can_manage_competition(competition_id)
    OR EXISTS (
      SELECT 1 FROM typing_game.competition_entries e
      WHERE e.competition_id = competition_state_events.competition_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY adjustments_select_scoped ON typing_game.competition_adjustments
  FOR SELECT TO authenticated
  USING (
    typing_game.fn_can_manage_competition(competition_id)
    OR (scope = 'participant' AND ref_id = auth.uid())
  );
