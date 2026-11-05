// Run with the migration owner AFTER migrations. Credentials stay in environment only.
const { Client } = require("pg");
(async () => {
  const url = process.env.CUSTOMER_SERVICE_MIGRATION_DATABASE_URL;
  const runtime = process.env.CUSTOMER_SERVICE_DATABASE_URL;
  if (!url || !runtime || url === runtime)
    throw Error("Separate CRM owner and runtime URLs are required");
  const ownerUrl = new URL(url),
    appUrl = new URL(runtime);
  if (ownerUrl.host !== appUrl.host || ownerUrl.pathname !== appUrl.pathname)
    throw Error("Owner/runtime must target the same CRM database");
  const role = decodeURIComponent(appUrl.username),
    password = decodeURIComponent(appUrl.password);
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role) || role === "postgres")
    throw Error("Invalid restricted runtime role");
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const owner = (await c.query("SELECT current_user AS name")).rows[0].name;
    if (owner === role) throw Error("Runtime must not own migrations");
    const quote = (s) => '"' + s.replace(/"/g, '""') + '"';
    if (
      !(await c.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
        .rowCount
    )
      await c.query(
        "CREATE ROLE " +
          quote(role) +
          " LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS",
      );
    await c.query(
      "ALTER ROLE " +
        quote(role) +
        " NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '" +
        password.replace(/'/g, "''") +
        "'",
    );
    await c.query("GRANT USAGE ON SCHEMA public TO " + quote(role));
    await c.query(
      "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO " +
        quote(role),
    );
    await c.query(
      "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO " + quote(role),
    );
    await c.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE " +
        quote(owner) +
        " IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO " +
        quote(role),
    );
    await c.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE " +
        quote(owner) +
        " IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO " +
        quote(role),
    );
    await c.query(
      'REVOKE UPDATE,DELETE ON "History","Audit" FROM ' + quote(role),
    );
    await c.query('REVOKE ALL ON "_prisma_migrations" FROM ' + quote(role));
    if ((await c.query("SELECT to_regclass('public.\"ChatEvent\"') AS name")).rows[0].name) {
      await c.query('REVOKE UPDATE,DELETE ON "ChatEvent","ChatMessage" FROM ' + quote(role));
    }
    console.log("CRM runtime grants configured.");
  } finally {
    await c.end();
  }
})().catch(() => {
  console.error(
    "CRM role provisioning failed. Check privileged access and role configuration.",
  );
  process.exitCode = 1;
});
