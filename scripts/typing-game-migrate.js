/**
 * typing-game-migrate.js — applies the typing-game platform's own SQL files
 * (supabase-migrations/typing-game/*.sql) against the same Postgres database
 * Prisma uses. Runs after startup.js, before prisma/seed.js (see Dockerfile
 * CMD). Tracked separately from Prisma's own migration history
 * (typing_game._migrations) because these files define tables/functions
 * schema.prisma doesn't know about — folding them into prisma/migrations
 * would fight Prisma's own drift detection.
 *
 * Uses `pg` directly rather than Prisma's $executeRawUnsafe: these files are
 * genuine multi-statement scripts (DO $$ ... $$ blocks, CREATE FUNCTION
 * bodies with embedded semicolons) sent over Postgres's simple query
 * protocol, which Prisma's raw-query methods (prepared-statement protocol)
 * don't reliably support for multi-statement text.
 *
 * Always exits 0, mirroring startup.js, so a migration issue never blocks
 * server startup — but logs loudly so it's visible in `docker logs`.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase-migrations", "typing-game");

async function run() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.log("[typing-game-migrate] No migrations directory found, skipping.");
        return;
    }

    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();

    if (files.length === 0) {
        console.log("[typing-game-migrate] No .sql files found, skipping.");
        return;
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        await client.query(`
            CREATE SCHEMA IF NOT EXISTS typing_game;
            CREATE TABLE IF NOT EXISTS typing_game._migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        const { rows } = await client.query(`SELECT filename FROM typing_game._migrations;`);
        const applied = new Set(rows.map((r) => r.filename));

        for (const file of files) {
            if (applied.has(file)) continue;

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
            console.log(`[typing-game-migrate] Applying ${file}...`);
            try {
                await client.query("BEGIN");
                await client.query(sql);
                await client.query(`INSERT INTO typing_game._migrations (filename) VALUES ($1);`, [file]);
                await client.query("COMMIT");
                console.log(`[typing-game-migrate] ✓ ${file}`);
            } catch (err) {
                await client.query("ROLLBACK");
                console.error(`[typing-game-migrate] ✗ ${file} failed:`, err.message);
                // Later files likely depend on this one (functions/tables
                // referencing each other in order) — stop rather than skip ahead.
                break;
            }
        }

        // PostgREST's login role password is a secret, deliberately kept out
        // of the .sql files / git history — set it here from the env var on
        // every run (idempotent; ALTER ROLE isn't tracked in _migrations).
        if (process.env.PGRST_AUTHENTICATOR_PASSWORD) {
            const escaped = process.env.PGRST_AUTHENTICATOR_PASSWORD.replace(/'/g, "''");
            try {
                await client.query(`ALTER ROLE authenticator WITH PASSWORD '${escaped}';`);
                console.log("[typing-game-migrate] ✓ authenticator role password set");
            } catch (err) {
                console.error("[typing-game-migrate] Could not set authenticator password:", err.message);
            }
        } else {
            console.warn(
                "[typing-game-migrate] PGRST_AUTHENTICATOR_PASSWORD not set — PostgREST will not be able to connect."
            );
        }
    } finally {
        await client.end();
    }
}

run()
    .then(() => {
        console.log("[typing-game-migrate] Done.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("[typing-game-migrate] Fatal error:", err);
        process.exit(0); // never block server startup
    });
