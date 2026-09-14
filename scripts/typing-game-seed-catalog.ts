/**
 * Seeds typing_game.worlds / prompt_sets / games / game_versions from the
 * TypeScript content catalog (src/lib/typing-game/content) — the source of
 * truth for game content, same design as the original source project's
 * scripts/seed-catalog.ts, rewritten against plain `pg` instead of a
 * Supabase service-role client (this project has no Supabase/service_role;
 * the DB user in DATABASE_URL owns these tables and bypasses their RLS the
 * same way scripts/typing-game-migrate.js already relies on).
 *
 * Safe to re-run: unchanged games are left alone; changed definitions
 * append a new game_versions row and bump current_version. History is
 * never rewritten.
 *
 * Usage: npx tsx scripts/typing-game-seed-catalog.ts
 * (Not wired into the Docker CMD like typing-game-migrate.js — game content
 * changes far less often than schema, so this is run manually / in CI when
 * the content catalog changes, not on every container start.)
 */
import { Client } from "pg";
import { GAMES, PROMPT_SETS, WORLDS, validateCatalog } from "../src/lib/typing-game/content";
import type { GameDefinition } from "../src/lib/typing-game/game-engine";

/**
 * Deterministic stringify (recursively sorted object keys). Postgres's jsonb
 * storage doesn't preserve key insertion order, so a naive
 * JSON.stringify(fromDb) !== JSON.stringify(fromCatalog) comparison reports
 * a "change" on every run even when nothing changed — this normalizes both
 * sides the same way before comparing.
 */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
}

function definitionRow(game: GameDefinition) {
  return {
    slug: game.slug,
    world_id: game.worldSlug,
    category: game.category,
    mechanic: game.mechanic,
    mode: game.mode,
    difficulty: game.difficulty,
    skill_bands: game.skillBands,
    prompt_set_ref: game.promptSource.ref,
    prompt_units: game.promptSource.units,
    input: game.inputRules,
    timing: game.timingRules,
    scoring_profile_id: game.scoringProfile,
    unlock_rule: game.unlockRule,
    attempt_rules: game.attemptRules,
    theme: game.theme,
    config: game.config,
    competition_eligible: game.competitionEligible,
    is_active: game.isActive,
  };
}

async function upsertGame(client: Client, game: GameDefinition): Promise<string> {
  const row = definitionRow(game);
  const existing = await client.query(
    `SELECT id, current_version FROM typing_game.games WHERE slug = $1`,
    [row.slug],
  );

  let gameId: string;
  let created = false;
  if (existing.rows.length === 0) {
    const inserted = await client.query(
      `INSERT INTO typing_game.games
         (slug, world_id, category, mechanic, mode, difficulty, skill_bands,
          prompt_set_ref, prompt_units, input, timing, scoring_profile_id,
          unlock_rule, attempt_rules, theme, config, competition_eligible,
          is_active, current_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        row.slug, row.world_id, row.category, row.mechanic, row.mode, row.difficulty,
        row.skill_bands, row.prompt_set_ref, row.prompt_units, row.input, row.timing,
        row.scoring_profile_id, row.unlock_rule, row.attempt_rules, row.theme, row.config,
        row.competition_eligible, row.is_active, game.version,
      ],
    );
    gameId = inserted.rows[0].id as string;
    created = true;
  } else {
    gameId = existing.rows[0].id as string;
    await client.query(
      `UPDATE typing_game.games SET
         world_id=$2, category=$3, mechanic=$4, mode=$5, difficulty=$6, skill_bands=$7,
         prompt_set_ref=$8, prompt_units=$9, input=$10, timing=$11, scoring_profile_id=$12,
         unlock_rule=$13, attempt_rules=$14, theme=$15, config=$16, competition_eligible=$17,
         is_active=$18
       WHERE id=$1`,
      [
        gameId, row.world_id, row.category, row.mechanic, row.mode, row.difficulty,
        row.skill_bands, row.prompt_set_ref, row.prompt_units, row.input, row.timing,
        row.scoring_profile_id, row.unlock_rule, row.attempt_rules, row.theme, row.config,
        row.competition_eligible, row.is_active,
      ],
    );
  }

  const latest = await client.query(
    `SELECT version, definition FROM typing_game.game_versions
     WHERE game_id = $1 ORDER BY version DESC LIMIT 1`,
    [gameId],
  );
  const latestDef = latest.rows[0]?.definition ?? null;
  if (canonicalStringify(latestDef) !== canonicalStringify(game)) {
    const nextVersion = (latest.rows[0]?.version ?? 0) + 1;
    await client.query(
      `INSERT INTO typing_game.game_versions (game_id, version, definition) VALUES ($1,$2,$3)`,
      [gameId, nextVersion, JSON.stringify(game)],
    );
    await client.query(`UPDATE typing_game.games SET current_version=$2 WHERE id=$1`, [gameId, nextVersion]);
    return created ? "created" : "updated-new-version";
  }
  return created ? "created" : "updated-same-version";
}

async function main(): Promise<void> {
  const errors = validateCatalog();
  if (errors.length > 0) {
    console.error("seed:catalog FAILED — catalog invalid:\n- " + errors.join("\n- "));
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    let worlds = 0;
    for (const w of WORLDS) {
      await client.query(
        `INSERT INTO typing_game.worlds (id, sort_order, name_en, name_bn, description_en, description_bn)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           sort_order=EXCLUDED.sort_order, name_en=EXCLUDED.name_en, name_bn=EXCLUDED.name_bn,
           description_en=EXCLUDED.description_en, description_bn=EXCLUDED.description_bn`,
        [w.slug, w.order, w.name.en, w.name.bn, w.description.en, w.description.bn],
      );
      worlds += 1;
    }

    let sets = 0;
    for (const set of Object.values(PROMPT_SETS)) {
      await client.query(
        `INSERT INTO typing_game.prompt_sets (ref, version, kind, language, items)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (ref) DO UPDATE SET
           version=EXCLUDED.version, kind=EXCLUDED.kind, language=EXCLUDED.language, items=EXCLUDED.items`,
        [set.ref, set.version, set.kind, set.language, JSON.stringify(set.items)],
      );
      sets += 1;
    }

    let games = 0;
    let versions = 0;
    for (const game of GAMES) {
      const outcome = await upsertGame(client, game);
      if (outcome !== "updated-same-version") versions += 1;
      games += 1;
    }

    console.log(
      `seed:catalog OK — worlds=${worlds} prompt_sets=${sets} games=${games} new_versions=${versions}`,
    );
  } finally {
    await client.end();
  }
}

void main();
