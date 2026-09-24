/**
 * ensure-app-role.js — creates the unprivileged role the app runs queries as.
 *
 * Why this exists: every course-scoped table has a row-level security policy
 * (prisma/migrations/*_enable_row_level_security), but **Postgres exempts
 * superusers from RLS entirely** — FORCE ROW LEVEL SECURITY does not change
 * that; it only removes the exemption for a table's *owner*. The postgres
 * image always creates POSTGRES_USER as a superuser, so while Prisma connects
 * as that role, the tenant-isolation policies are decorative and the only
 * thing separating two courses' data is the `where courseId` in application
 * code.
 *
 * So: migrations and schema patches keep running as the superuser (they need
 * DDL), and the *server* connects as `asm_app`, which
 *   - is NOSUPERUSER / NOCREATEDB / NOCREATEROLE / NOBYPASSRLS,
 *   - owns nothing, so it can't ALTER TABLE ... DISABLE ROW LEVEL SECURITY,
 *   - holds only SELECT/INSERT/UPDATE/DELETE.
 *
 * Run as the superuser, before migrations, on every boot. Idempotent.
 */

const { Client } = require("pg");

const APP_ROLE = process.env.APP_DB_USER || "asm_app";
const APP_PASSWORD = process.env.APP_DB_PASSWORD;

async function run() {
    if (!APP_PASSWORD) {
        console.warn(
            "[ensure-app-role] APP_DB_PASSWORD is not set — skipping. The app will " +
            "keep connecting as the superuser, which BYPASSES row-level security."
        );
        return;
    }

    const connectionString = process.env.BOOTSTRAP_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.warn("[ensure-app-role] No database URL available — skipping.");
        return;
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        const dbName = (await client.query("SELECT current_database() AS db")).rows[0].db;

        // CREATE ROLE has no IF NOT EXISTS; catching duplicate_object is the
        // documented idiom. The password is re-applied every boot so rotating
        // APP_DB_PASSWORD in the environment is all that's needed.
        await client.query(`
            DO $$ BEGIN
                CREATE ROLE ${quoteIdent(APP_ROLE)} LOGIN
                    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        // ALTER ROLE is a utility statement: Postgres rejects bind parameters
        // in it, so the password has to be escaped into the SQL text.
        // client.escapeLiteral is pg's own quoting for exactly this.
        await client.query(
            `ALTER ROLE ${quoteIdent(APP_ROLE)} WITH LOGIN NOSUPERUSER NOCREATEDB ` +
            `NOCREATEROLE NOBYPASSRLS PASSWORD ${client.escapeLiteral(APP_PASSWORD)}`
        );

        await client.query(`GRANT CONNECT ON DATABASE ${quoteIdent(dbName)} TO ${quoteIdent(APP_ROLE)}`);
        await client.query(`GRANT USAGE ON SCHEMA public TO ${quoteIdent(APP_ROLE)}`);

        // Data access only — no DDL, no TRUNCATE, no REFERENCES.
        await client.query(`
            GRANT SELECT, INSERT, UPDATE, DELETE
            ON ALL TABLES IN SCHEMA public TO ${quoteIdent(APP_ROLE)}
        `);
        await client.query(`
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdent(APP_ROLE)}
        `);

        // Tables a *future* migration creates need the same grants, and
        // default privileges are recorded per granting role — so this has to
        // be attached to whichever role the migrations actually run as.
        const migrationRole = (await client.query("SELECT current_user AS role")).rows[0].role;
        await client.query(`
            ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(migrationRole)} IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdent(APP_ROLE)}
        `);
        await client.query(`
            ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(migrationRole)} IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO ${quoteIdent(APP_ROLE)}
        `);

        // The typing-game schema is fronted by PostgREST under its own roles,
        // but the app also reaches it directly in places.
        await client.query(`
            DO $$ BEGIN
                EXECUTE 'GRANT USAGE ON SCHEMA typing_game TO ${quoteIdent(APP_ROLE)}';
                EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA typing_game TO ${quoteIdent(APP_ROLE)}';
                EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA typing_game TO ${quoteIdent(APP_ROLE)}';
            EXCEPTION WHEN invalid_schema_name THEN NULL;
            END $$;
        `);

        const check = await client.query(
            "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1",
            [APP_ROLE]
        );
        const row = check.rows[0];
        if (!row) {
            throw new Error(`Role ${APP_ROLE} was not created.`);
        }
        if (row.rolsuper || row.rolbypassrls) {
            // Refuse to pretend this worked — RLS would still be bypassed.
            throw new Error(
                `Role ${APP_ROLE} is superuser/bypassrls; row-level security would not apply.`
            );
        }

        console.log(`[ensure-app-role] ✓ ${APP_ROLE} ready (NOSUPERUSER, NOBYPASSRLS)`);
    } finally {
        await client.end();
    }
}

/** Minimal identifier quoting — these come from env, not user input. */
function quoteIdent(name) {
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
        throw new Error(`Unsafe SQL identifier: ${name}`);
    }
    return `"${name}"`;
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("[ensure-app-role] Fatal:", err.message);
        // Fatal on purpose: if this fails the server would fall back to the
        // superuser connection and run without tenant isolation.
        process.exit(1);
    });
