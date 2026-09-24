/**
 * Seeds typing_game.worlds / prompt_sets / games / game_versions at boot,
 * from the JSON artifact that scripts/typing-game-export-catalog.ts emits
 * during the Docker build.
 *
 * Why a second, plain-JS seeder: scripts/typing-game-seed-catalog.ts imports
 * the TypeScript catalog and needs tsx + src/, neither of which exist in the
 * production image. Boot-time seeding is not optional — the schema migration
 * creates EMPTY content tables, so without this every world, game and prompt
 * set is missing and no student can start a single attempt.
 *
 * Idempotent and safe to re-run on every boot, exactly like the .ts version:
 * unchanged games are left alone; a changed definition appends a new
 * game_versions row and bumps current_version. History is never rewritten.
 * Runs as a best-effort boot step (see the Dockerfile CMD), so a failure here
 * logs and exits non-zero without blocking the server.
 */
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const ARTIFACT = path.resolve(__dirname, "../generated/typing-game-catalog.json");

/**
 * Deterministic stringify (recursively sorted keys). Postgres's jsonb does
 * not preserve key order, so a naive compare reports a "change" on every run.
 */
function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function definitionRow(game) {
  return [
    game.slug,
    game.worldSlug,
    game.category,
    game.mechanic,
    game.mode,
    game.difficulty,
    game.skillBands,
    game.promptSource.ref,
    game.promptSource.units,
    game.inputRules,
    game.timingRules,
    game.scoringProfile,
    game.unlockRule,
    game.attemptRules,
    game.theme,
    game.config,
    game.competitionEligible,
    game.isActive,
  ];
}

async function upsertGame(client, game) {
  const cols = definitionRow(game);
  const existing = await client.query(
    "SELECT id, current_version FROM typing_game.games WHERE slug = $1",
    [game.slug],
  );

  let gameId;
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
      [...cols, game.version],
    );
    gameId = inserted.rows[0].id;
    created = true;
  } else {
    gameId = existing.rows[0].id;
    await client.query(
      `UPDATE typing_game.games SET
         world_id=$2, category=$3, mechanic=$4, mode=$5, difficulty=$6, skill_bands=$7,
         prompt_set_ref=$8, prompt_units=$9, input=$10, timing=$11, scoring_profile_id=$12,
         unlock_rule=$13, attempt_rules=$14, theme=$15, config=$16, competition_eligible=$17,
         is_active=$18
       WHERE id=$1`,
      [gameId, ...cols.slice(1)],
    );
  }

  const latest = await client.query(
    `SELECT version, definition FROM typing_game.game_versions
     WHERE game_id = $1 ORDER BY version DESC LIMIT 1`,
    [gameId],
  );
  const latestDef = latest.rows[0] ? latest.rows[0].definition : null;
  if (canonicalStringify(latestDef) !== canonicalStringify(game)) {
    const nextVersion = (latest.rows[0] ? latest.rows[0].version : 0) + 1;
    await client.query(
      "INSERT INTO typing_game.game_versions (game_id, version, definition) VALUES ($1,$2,$3)",
      [gameId, nextVersion, JSON.stringify(game)],
    );
    await client.query("UPDATE typing_game.games SET current_version=$2 WHERE id=$1", [
      gameId,
      nextVersion,
    ]);
    return created ? "created" : "updated";
  }
  return "unchanged";
}

async function main() {
  if (!fs.existsSync(ARTIFACT)) {
    console.error(
      `[typing-game] seed:catalog SKIPPED — missing ${ARTIFACT}. ` +
        "Run `npm run export:typing-game-catalog` during the build.",
    );
    process.exitCode = 1;
    return;
  }
  const catalog = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const w of catalog.worlds) {
      await client.query(
        `INSERT INTO typing_game.worlds (id, sort_order, name_en, name_bn, description_en, description_bn)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           sort_order=EXCLUDED.sort_order, name_en=EXCLUDED.name_en, name_bn=EXCLUDED.name_bn,
           description_en=EXCLUDED.description_en, description_bn=EXCLUDED.description_bn`,
        [w.slug, w.order, w.name.en, w.name.bn, w.description.en, w.description.bn],
      );
    }

    for (const set of catalog.promptSets) {
      await client.query(
        `INSERT INTO typing_game.prompt_sets (ref, version, kind, language, items)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (ref) DO UPDATE SET
           version=EXCLUDED.version, kind=EXCLUDED.kind,
           language=EXCLUDED.language, items=EXCLUDED.items`,
        [set.ref, set.version, set.kind, set.language, JSON.stringify(set.items)],
      );
    }

    const counts = { created: 0, updated: 0, unchanged: 0 };
    for (const game of catalog.games) {
      counts[await upsertGame(client, game)] += 1;
    }

    console.log(
      `[typing-game] seed:catalog OK — worlds=${catalog.worlds.length} ` +
        `prompt_sets=${catalog.promptSets.length} games=${catalog.games.length} ` +
        `(created=${counts.created} updated=${counts.updated} unchanged=${counts.unchanged})`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[typing-game] seed:catalog FAILED —", err.message);
  process.exitCode = 1;
});
