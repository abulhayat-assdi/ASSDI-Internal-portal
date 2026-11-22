-- Staff consoles v2: one-call dashboards over the new learning data
-- (lessons, tests, arcade, daily typing time), and a feature-flag cleanup.
--
-- 1. Feature flags: only flags that really switch something stay. Ads are
--    controlled by the super admin's ad settings (0048), never by a flag.
-- 2. fn_feature_on / fn_my_features: effective flag value (org override,
--    else platform default).
-- 3. fn_staff_insights / fn_staff_students: dashboards for exactly the
--    batches the caller may see (super admin: all · org admin: own org ·
--    teacher: assigned batches/courses).
-- 4. Teachers may read the arcade runs of their students.

CREATE SCHEMA IF NOT EXISTS typing_game;
SET search_path = typing_game, public;

-- ---------------------------------------------------------------------------
-- 1. Flags
-- ---------------------------------------------------------------------------
DELETE FROM typing_game.feature_flags
WHERE key IN ('PHASE_1_CORE', 'PHASE_2_ADAPTIVE', 'PHASE_2_REWARDED_ADS', 'PHASE_3_CLAN_WARS',
              'PHASE_3_SEASONS', 'REWARDED_ADS_ENABLED', 'GOOGLE_REWARDED_ENABLED',
              'SHOP_ENABLED', 'TOURNAMENTS_ENABLED');

INSERT INTO typing_game.feature_flags (key, enabled, description) VALUES
  ('MISSIONS_ENABLED', true, 'Daily/weekly missions'),
  ('ARCADE_GAMES_ENABLED', true, 'Typing Arcade games'),
  ('BATCH_COMPETITION_ENABLED', true, 'Batchmate challenges and live races')
ON CONFLICT (key) WHERE org_id IS NULL DO NOTHING;

-- Effective value of a flag for an organization (its override, else the default).
CREATE OR REPLACE FUNCTION typing_game.fn_feature_on(p_key text, p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM typing_game.feature_flags WHERE key = p_key AND org_id = p_org),
    (SELECT enabled FROM typing_game.feature_flags WHERE key = p_key AND org_id IS NULL),
    false);
$$;
REVOKE ALL ON FUNCTION typing_game.fn_feature_on(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_feature_on(text, uuid) TO authenticated;

-- The org a student belongs to (their newest active batch).
CREATE OR REPLACE FUNCTION typing_game.fn_user_org(p_user uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT c.organization_id
  FROM typing_game.batch_members bm
  JOIN typing_game.batches b ON b.id = bm.batch_id
  JOIN typing_game.courses c ON c.id = b.course_id
  WHERE bm.user_id = p_user AND bm.is_active
  ORDER BY bm.joined_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_user_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_user_org(uuid) TO authenticated;

-- Every flag's effective value for the calling student: {"KEY": true, ...}.
CREATE OR REPLACE FUNCTION typing_game.fn_my_features()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT COALESCE(jsonb_object_agg(f.key, typing_game.fn_feature_on(f.key, typing_game.fn_user_org(auth.uid()))), '{}'::jsonb)
  FROM typing_game.feature_flags f WHERE f.org_id IS NULL;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_my_features() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_my_features() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Teachers read their students' arcade runs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS arcade_sessions_select_teacher ON typing_game.arcade_sessions;
CREATE POLICY arcade_sessions_select_teacher ON typing_game.arcade_sessions
  FOR SELECT TO authenticated USING (typing_game.fn_teaches_student(user_id));

-- ---------------------------------------------------------------------------
-- 3. Dashboards
-- ---------------------------------------------------------------------------
-- Batches the caller may see, optionally narrowed to p_batch_ids.
CREATE OR REPLACE FUNCTION typing_game.fn_staff_batches(p_batch_ids uuid[] DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT b.id
  FROM typing_game.batches b
  JOIN typing_game.courses c ON c.id = b.course_id
  WHERE (p_batch_ids IS NULL OR b.id = ANY (p_batch_ids))
    AND (typing_game.is_org_admin(c.organization_id) OR typing_game.is_teacher_of_batch(b.id));
$$;
REVOKE ALL ON FUNCTION typing_game.fn_staff_batches(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_staff_batches(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION typing_game.fn_staff_insights(p_batch_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _ins_b (id uuid PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _ins_m (user_id uuid, batch_id uuid, roll text) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _ins_u (user_id uuid PRIMARY KEY, batch_id uuid, roll text,
    minutes_today numeric, minutes_7d numeric, last_day date, lessons int, lessons_7d int,
    tests_30d int, test_wpm numeric, test_acc numeric, games_7d int) ON COMMIT DROP;
  TRUNCATE _ins_b, _ins_m, _ins_u;

  INSERT INTO _ins_b SELECT DISTINCT * FROM typing_game.fn_staff_batches(p_batch_ids);
  INSERT INTO _ins_m
    SELECT bm.user_id, bm.batch_id, bm.roll_number FROM typing_game.batch_members bm
    JOIN _ins_b b ON b.id = bm.batch_id WHERE bm.is_active;

  INSERT INTO _ins_u
  SELECT u.user_id, u.batch_id, u.roll,
    COALESCE((SELECT typing_ms FROM typing_game.daily_activity d WHERE d.user_id = u.user_id AND d.day = v_today), 0) / 60000.0,
    COALESCE((SELECT sum(typing_ms) FROM typing_game.daily_activity d WHERE d.user_id = u.user_id AND d.day > v_today - 7), 0) / 60000.0,
    (SELECT max(day) FROM typing_game.daily_activity d WHERE d.user_id = u.user_id AND d.typing_ms > 0),
    (SELECT count(*) FROM typing_game.lesson_progress l WHERE l.user_id = u.user_id AND l.status = 'completed'),
    (SELECT count(*) FROM typing_game.lesson_progress l WHERE l.user_id = u.user_id AND l.status = 'completed' AND l.completed_at > now() - interval '7 days'),
    (SELECT count(*) FROM typing_game.typing_test_sessions t WHERE t.user_id = u.user_id AND t.status = 'graded' AND t.graded_at > now() - interval '30 days'),
    (SELECT max(wpm) FROM typing_game.typing_test_sessions t WHERE t.user_id = u.user_id AND t.status = 'graded' AND t.graded_at > now() - interval '30 days'),
    (SELECT avg(accuracy) FROM typing_game.typing_test_sessions t WHERE t.user_id = u.user_id AND t.status = 'graded' AND t.graded_at > now() - interval '30 days'),
    (SELECT count(*) FROM typing_game.arcade_sessions a WHERE a.user_id = u.user_id AND a.status = 'finished' AND a.finished_at > now() - interval '7 days')
  FROM (SELECT DISTINCT ON (user_id) user_id, batch_id, roll FROM _ins_m ORDER BY user_id) u;

  SELECT jsonb_build_object(
    'today', v_today,
    'totals', (SELECT jsonb_build_object(
        'batches', (SELECT count(*) FROM _ins_b),
        'activeBatches', (SELECT count(*) FROM _ins_b JOIN typing_game.batches b USING (id) WHERE b.is_active),
        'students', count(*),
        'activeToday', count(*) FILTER (WHERE minutes_today > 0),
        'active7d', count(*) FILTER (WHERE last_day > v_today - 7),
        'neverStarted', count(*) FILTER (WHERE last_day IS NULL AND lessons = 0),
        'minutesToday', round(COALESCE(sum(minutes_today), 0)),
        'minutes7d', round(COALESCE(sum(minutes_7d), 0)),
        'lessonsTotal', COALESCE(sum(lessons), 0),
        'lessons7d', COALESCE(sum(lessons_7d), 0),
        'tests30d', COALESCE(sum(tests_30d), 0),
        'avgBestWpm', round(avg(test_wpm), 1),
        'avgAccuracy', round(avg(test_acc), 1),
        'games7d', COALESCE(sum(games_7d), 0)) FROM _ins_u),
    'days', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', g.day, 'minutes', round(COALESCE(x.ms, 0) / 60000.0), 'active', COALESCE(x.n, 0)) ORDER BY g.day), '[]'::jsonb)
             FROM (SELECT generate_series(v_today - 13, v_today, interval '1 day')::date AS day) g
             LEFT JOIN (SELECT d.day, sum(d.typing_ms) ms, count(*) FILTER (WHERE d.typing_ms > 0) n
                        FROM typing_game.daily_activity d JOIN _ins_u u USING (user_id)
                        WHERE d.day > v_today - 14 GROUP BY d.day) x ON x.day = g.day),
    'batches', (SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'active') DESC, row->>'name'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', b.id, 'name', b.name, 'course', c.title, 'joinCode', b.join_code, 'active', b.is_active,
          'members', (SELECT count(*) FROM _ins_m m WHERE m.batch_id = b.id),
          'active7d', (SELECT count(*) FROM _ins_u u JOIN _ins_m m ON m.user_id = u.user_id AND m.batch_id = b.id WHERE u.last_day > v_today - 7),
          'minutes7d', (SELECT round(COALESCE(sum(u.minutes_7d), 0)) FROM _ins_u u JOIN _ins_m m ON m.user_id = u.user_id AND m.batch_id = b.id),
          'lessonsAvg', (SELECT round(COALESCE(avg(u.lessons), 0), 1) FROM _ins_u u JOIN _ins_m m ON m.user_id = u.user_id AND m.batch_id = b.id),
          'avgWpm', (SELECT round(avg(u.test_wpm), 1) FROM _ins_u u JOIN _ins_m m ON m.user_id = u.user_id AND m.batch_id = b.id),
          'teachers', (SELECT COALESCE(jsonb_agg(DISTINCT p.full_name), '[]'::jsonb)
                       FROM typing_game.teacher_assignments ta JOIN typing_game.profiles p ON p.id = ta.user_id
                       WHERE ta.batch_id = b.id OR (ta.batch_id IS NULL AND ta.course_id = b.course_id))
        ) AS row
        FROM _ins_b ib JOIN typing_game.batches b ON b.id = ib.id JOIN typing_game.courses c ON c.id = b.course_id) s),
    'top', (SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('userId', u.user_id, 'name', p.full_name, 'roll', u.roll, 'batch', b.name,
                                  'minutes', round(u.minutes_7d), 'level', p.current_level, 'wpm', round(u.test_wpm), 'lessons7d', u.lessons_7d) AS row
        FROM _ins_u u JOIN typing_game.profiles p ON p.id = u.user_id JOIN typing_game.batches b ON b.id = u.batch_id
        WHERE u.minutes_7d > 0 ORDER BY u.minutes_7d DESC LIMIT 5) s),
    'attention', (SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('userId', u.user_id, 'name', p.full_name, 'roll', u.roll, 'batch', b.name,
          'reason', CASE WHEN u.last_day IS NULL AND u.lessons = 0 THEN 'never'
                         WHEN u.last_day IS NULL OR u.last_day <= v_today - 7 THEN 'inactive'
                         ELSE 'accuracy' END,
          'lastDay', u.last_day, 'accuracy', round(u.test_acc)) AS row
        FROM _ins_u u JOIN typing_game.profiles p ON p.id = u.user_id JOIN typing_game.batches b ON b.id = u.batch_id
        WHERE u.last_day IS NULL OR u.last_day <= v_today - 7 OR (u.tests_30d >= 2 AND u.test_acc < 85)
        ORDER BY (u.last_day IS NOT NULL AND u.last_day > v_today - 7), u.last_day DESC NULLS LAST, p.full_name
        LIMIT 12) s),
    'attentionCount', (SELECT count(*) FROM _ins_u u WHERE u.last_day IS NULL OR u.last_day <= v_today - 7 OR (u.tests_30d >= 2 AND u.test_acc < 85)),
    'levels', (SELECT COALESCE(jsonb_agg(jsonb_build_object('levelId', level_id, 'students', n, 'completions', c) ORDER BY level_id), '[]'::jsonb) FROM (
        SELECT l.level_id, count(DISTINCT l.user_id) n, count(*) c FROM typing_game.lesson_progress l JOIN _ins_u u USING (user_id)
        WHERE l.status = 'completed' GROUP BY l.level_id) s),
    'wpmBuckets', (SELECT jsonb_build_object(
        'lt20', count(*) FILTER (WHERE test_wpm < 20), 'w20', count(*) FILTER (WHERE test_wpm >= 20 AND test_wpm < 30),
        'w30', count(*) FILTER (WHERE test_wpm >= 30 AND test_wpm < 40), 'w40', count(*) FILTER (WHERE test_wpm >= 40 AND test_wpm < 50),
        'w50', count(*) FILTER (WHERE test_wpm >= 50), 'none', count(*) FILTER (WHERE test_wpm IS NULL)) FROM _ins_u),
    'games', (SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', game_slug, 'plays', n, 'players', p, 'best', best) ORDER BY n DESC), '[]'::jsonb) FROM (
        SELECT a.game_slug, count(*) n, count(DISTINCT a.user_id) p, max(a.score) best FROM typing_game.arcade_sessions a JOIN _ins_u u USING (user_id)
        WHERE a.status = 'finished' AND a.finished_at > now() - interval '30 days' GROUP BY a.game_slug) s)
  ) INTO v_out;

  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_staff_insights(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_staff_insights(uuid[]) TO authenticated;

-- Student list with progress, for the batches the caller may see.
CREATE OR REPLACE FUNCTION typing_game.fn_staff_students(
  p_batch_ids uuid[] DEFAULT NULL, p_q text DEFAULT NULL, p_limit int DEFAULT 200
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Asia/Dhaka')::date AS d),
  m AS (
    SELECT DISTINCT ON (bm.user_id) bm.user_id, bm.batch_id, bm.roll_number, bm.is_active
    FROM typing_game.batch_members bm
    WHERE bm.batch_id IN (SELECT typing_game.fn_staff_batches(p_batch_ids))
    ORDER BY bm.user_id, bm.is_active DESC, bm.joined_at DESC
  )
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'userId', m.user_id, 'name', p.full_name, 'email', p.email, 'roll', m.roll_number,
      'batchId', m.batch_id, 'batch', b.name, 'memberActive', m.is_active, 'status', p.account_status,
      'level', p.current_level, 'xp', p.xp_total, 'coins', p.coin_balance,
      'lessons', (SELECT count(*) FROM typing_game.lesson_progress l WHERE l.user_id = m.user_id AND l.status = 'completed'),
      'bestWpm', (SELECT round(max(wpm)) FROM typing_game.typing_test_sessions t WHERE t.user_id = m.user_id AND t.status = 'graded'),
      'minutes7d', (SELECT round(COALESCE(sum(typing_ms), 0) / 60000.0) FROM typing_game.daily_activity d, today WHERE d.user_id = m.user_id AND d.day > today.d - 7),
      'lastDay', (SELECT max(day) FROM typing_game.daily_activity d WHERE d.user_id = m.user_id AND d.typing_ms > 0)
    ) AS row
    FROM m JOIN typing_game.profiles p ON p.id = m.user_id JOIN typing_game.batches b ON b.id = m.batch_id
    WHERE p_q IS NULL OR p_q = ''
       OR p.full_name ILIKE '%' || p_q || '%' OR p.email ILIKE '%' || p_q || '%' OR m.roll_number ILIKE '%' || p_q || '%'
    ORDER BY p.full_name
    LIMIT greatest(1, least(p_limit, 1000))
  ) s;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_staff_students(uuid[], text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_staff_students(uuid[], text, int) TO authenticated;

-- Teacher assignments in the caller's scope, with names and reach.
CREATE OR REPLACE FUNCTION typing_game.fn_staff_teachers()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'name', row->>'target'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', ta.id, 'userId', ta.user_id, 'name', COALESCE(NULLIF(p.full_name, ''), p.email, 'Teacher'), 'email', p.email,
      'courseId', ta.course_id, 'batchId', ta.batch_id,
      'target', COALESCE(b.name, c.title, ''),
      'scope', CASE WHEN ta.batch_id IS NOT NULL THEN 'batch' ELSE 'course' END,
      'students', (SELECT count(DISTINCT bm.user_id) FROM typing_game.batch_members bm JOIN typing_game.batches xb ON xb.id = bm.batch_id
                   WHERE bm.is_active AND (xb.id = ta.batch_id OR (ta.batch_id IS NULL AND xb.course_id = ta.course_id))),
      'createdAt', ta.created_at
    ) AS row
    FROM typing_game.teacher_assignments ta
    JOIN typing_game.profiles p ON p.id = ta.user_id
    LEFT JOIN typing_game.batches b ON b.id = ta.batch_id
    LEFT JOIN typing_game.courses c ON c.id = COALESCE(ta.course_id, b.course_id)
    WHERE typing_game.is_org_admin(c.organization_id)
  ) s;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_staff_teachers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_staff_teachers() TO authenticated;

-- One student's learning picture for staff (their org admin or their teacher).
CREATE OR REPLACE FUNCTION typing_game.fn_staff_student_progress(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
  IF NOT (typing_game.is_org_admin_of_user(p_user) OR typing_game.fn_teaches_student(p_user)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'today', v_today,
    'profile', (SELECT jsonb_build_object('name', full_name, 'email', email, 'level', current_level, 'xp', xp_total,
                       'coins', coin_balance, 'status', account_status) FROM typing_game.profiles WHERE id = p_user),
    'lessons', (SELECT COALESCE(jsonb_agg(jsonb_build_object('levelId', level_id, 'done', n, 'skipped', s, 'stars', st,
                       'bestWpm', w, 'last', last) ORDER BY level_id), '[]'::jsonb)
                FROM (SELECT level_id, count(*) FILTER (WHERE status = 'completed') n, count(*) FILTER (WHERE status = 'skipped') s,
                             COALESCE(sum(stars) FILTER (WHERE status = 'completed'), 0) st, round(max(best_wpm)) w, max(updated_at) last
                      FROM typing_game.lesson_progress WHERE user_id = p_user GROUP BY level_id) x),
    'tests', (SELECT COALESCE(jsonb_agg(jsonb_build_object('testId', test_id, 'language', language, 'wpm', round(wpm), 'accuracy', round(accuracy),
                     'at', graded_at) ORDER BY graded_at DESC), '[]'::jsonb)
              FROM (SELECT * FROM typing_game.typing_test_sessions WHERE user_id = p_user AND status = 'graded'
                    ORDER BY graded_at DESC LIMIT 8) t),
    'days', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', g.day, 'minutes', round(COALESCE(d.typing_ms, 0) / 60000.0), 'active', CASE WHEN COALESCE(d.typing_ms, 0) > 0 THEN 1 ELSE 0 END) ORDER BY g.day), '[]'::jsonb)
             FROM (SELECT generate_series(v_today - 13, v_today, interval '1 day')::date AS day) g
             LEFT JOIN typing_game.daily_activity d ON d.user_id = p_user AND d.day = g.day),
    'lastDay', (SELECT max(day) FROM typing_game.daily_activity WHERE user_id = p_user AND typing_ms > 0),
    'minutesTotal', (SELECT round(COALESCE(sum(typing_ms), 0) / 60000.0) FROM typing_game.daily_activity WHERE user_id = p_user),
    'games', (SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', game_slug, 'plays', n, 'best', best) ORDER BY n DESC), '[]'::jsonb)
              FROM (SELECT game_slug, count(*) n, max(score) best FROM typing_game.arcade_sessions
                    WHERE user_id = p_user AND status = 'finished' GROUP BY game_slug) a),
    'challenges', (SELECT jsonb_build_object(
                     'played', count(*),
                     'wins', count(*) FILTER (WHERE x.winner_id = p_user),
                     'draws', count(*) FILTER (WHERE x.winner_id IS NULL))
                   FROM typing_game.challenges x
                   WHERE x.status = 'finished' AND p_user IN (x.created_by, x.opponent_id))
  );
END;
$$;
REVOKE ALL ON FUNCTION typing_game.fn_staff_student_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typing_game.fn_staff_student_progress(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 5. The platform super admin works inside a course through a hidden
--    "shadow" admin row (public.users.is_super_admin_shadow). Give that row
--    the typing super_admin role, so the super admin's own consoles (Ads,
--    feature defaults) are reachable from a course domain too. Unchanged
--    from 0041 otherwise.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION typing_game.fn_provision_staff_from_asm()
RETURNS typing_game.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = typing_game, public, pg_temp
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_org_id uuid;
  v_course_id uuid;
  v_profile typing_game.profiles;
BEGIN
  -- See 0040's fn_provision_from_asm for why this bypass is needed and safe:
  -- public.users/courses carry ASM's own FORCE ROW LEVEL SECURITY, which
  -- PostgREST's connection never satisfies on its own.
  PERFORM set_config('app.is_super_admin', 'true', true);

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid()::text;
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'fn_provision_staff_from_asm: no ASM user for auth.uid()';
  END IF;
  IF v_user.role NOT IN ('teacher', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'fn_provision_staff_from_asm: staff-only (role=%)', v_user.role;
  END IF;

  INSERT INTO typing_game.profiles (id, email, full_name)
  VALUES (auth.uid(), v_user.email, v_user.display_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  IF v_user.role = 'super_admin' OR COALESCE(v_user.is_super_admin_shadow, false) THEN
    INSERT INTO typing_game.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'super_admin', NULL)
    ON CONFLICT (user_id, role) WHERE organization_id IS NULL DO NOTHING;

  ELSIF v_user.role = 'admin' THEN
    IF v_user.course_id IS NULL THEN
      RAISE EXCEPTION 'fn_provision_staff_from_asm: admin % has no course_id', v_user.id;
    END IF;

    INSERT INTO typing_game.organizations (id, name, slug, asm_course_id)
    SELECT gen_random_uuid(), c.name, c.slug, c.id FROM public.courses c WHERE c.id = v_user.course_id
    ON CONFLICT (asm_course_id) DO NOTHING;
    SELECT id INTO v_org_id FROM typing_game.organizations WHERE asm_course_id = v_user.course_id;

    INSERT INTO typing_game.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'admin', v_org_id)
    ON CONFLICT (user_id, role, organization_id) DO NOTHING;

  ELSIF v_user.role = 'teacher' THEN
    IF v_user.course_id IS NULL THEN
      RAISE EXCEPTION 'fn_provision_staff_from_asm: teacher % has no course_id', v_user.id;
    END IF;

    INSERT INTO typing_game.organizations (id, name, slug, asm_course_id)
    SELECT gen_random_uuid(), c.name, c.slug, c.id FROM public.courses c WHERE c.id = v_user.course_id
    ON CONFLICT (asm_course_id) DO NOTHING;

    INSERT INTO typing_game.courses (id, organization_id, title, slug, asm_course_id)
    SELECT gen_random_uuid(), o.id, 'Typing Adventure', 'typing-adventure', o.asm_course_id
    FROM typing_game.organizations o WHERE o.asm_course_id = v_user.course_id
    ON CONFLICT (asm_course_id) DO NOTHING;
    SELECT id INTO v_course_id FROM typing_game.courses WHERE asm_course_id = v_user.course_id;

    INSERT INTO typing_game.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'teacher', NULL)
    ON CONFLICT (user_id, role) WHERE organization_id IS NULL DO NOTHING;

    -- teacher_assignments' UNIQUE (user_id, course_id, batch_id) doesn't
    -- de-dupe a repeated NULL batch_id (Postgres treats NULL <> NULL in
    -- unique constraints) — guard with an explicit existence check instead
    -- of ON CONFLICT.
    INSERT INTO typing_game.teacher_assignments (user_id, course_id)
    SELECT auth.uid(), v_course_id
    WHERE NOT EXISTS (
      SELECT 1 FROM typing_game.teacher_assignments
      WHERE user_id = auth.uid() AND course_id = v_course_id AND batch_id IS NULL
    );
  END IF;

  SELECT * INTO v_profile FROM typing_game.profiles WHERE id = auth.uid();
  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION typing_game.fn_provision_staff_from_asm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION typing_game.fn_provision_staff_from_asm() TO authenticated;
