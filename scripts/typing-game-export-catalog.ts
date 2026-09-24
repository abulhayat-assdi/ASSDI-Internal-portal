/**
 * Emits the TypeScript content catalog as a plain JSON artifact.
 *
 * Why this exists: the catalog lives in TypeScript under src/lib/typing-game/
 * content, but the production image runs a Next standalone bundle with no
 * tsx and no src/. Boot-time seeding therefore cannot import the catalog
 * directly. This runs in the Docker BUILDER stage (where devDependencies and
 * sources exist) and writes an artifact the plain-JS seeder reads at boot.
 *
 * Usage: npx tsx scripts/typing-game-export-catalog.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { GAMES, PROMPT_SETS, WORLDS, validateCatalog } from "../src/lib/typing-game/content";

const OUT = resolve(process.cwd(), "generated/typing-game-catalog.json");

const errors = validateCatalog();
if (errors.length > 0) {
  console.error("export:catalog FAILED — catalog invalid:\n- " + errors.join("\n- "));
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      worlds: WORLDS,
      promptSets: Object.values(PROMPT_SETS),
      games: GAMES,
    },
    null,
    2,
  ),
);
console.log(
  `export:catalog OK — worlds=${String(WORLDS.length)} prompt_sets=${String(
    Object.keys(PROMPT_SETS).length,
  )} games=${String(GAMES.length)} -> ${OUT}`,
);
