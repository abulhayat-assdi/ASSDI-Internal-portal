// Read-only readiness gate after prisma migrate deploy; never creates or seeds data.
const { Client } = require("pg");
const tables = [
  "programs",
  "teams",
  "members",
  "catalog",
  "sprints",
  "records",
  "corrections",
  "field_corrections",
  "field_sessions",
  "positions",
  "attachments",
  "audit",
].map((n) => "incubation_" + n);
async function check() {
  if (!process.env.DATABASE_URL)
    throw Error("DATABASE_URL is required for the schema readiness check");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class JOIN pg_namespace ns ON ns.oid=relnamespace WHERE ns.nspname='public' AND relname=ANY($1::text[])",
      [tables],
    );
    for (const name of tables) {
      const row = rows.find((r) => r.relname === name);
      if (!row || !row.relrowsecurity || !row.relforcerowsecurity)
        throw Error(`Incubation schema/RLS missing: ${name}`);
    }
    console.log(
      "[incubation] schema and course isolation ready; no data seeded",
    );
  } finally {
    await client.end();
  }
}
check().catch((e) => {
  console.error("[incubation] database readiness failed:", e.message);
  process.exitCode = 1;
});
