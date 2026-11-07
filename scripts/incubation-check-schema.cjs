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
  "notifications",
  "results",
].map((n) => "incubation_" + n).concat(["competition_submission_revisions"]);
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
    // The app connects as the runtime role; every feature table must be usable by it.
    const privileges = await client.query(
      "SELECT t FROM unnest($1::text[]) AS t WHERE NOT has_table_privilege(current_user, t, 'SELECT,INSERT,UPDATE,DELETE')",
      [tables],
    );
    if (privileges.rows.length)
      throw Error(
        `Runtime role ${"cannot read/write: " + privileges.rows.map((r) => r.t).join(", ")}`,
      );
    const softDelete = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='incubation_programs' AND column_name IN ('deleted_at','deleted_by','delete_reason')",
    );
    if (softDelete.rows[0].n !== 3) throw Error("Incubation program soft-delete columns are missing");
    const columns = await client.query(
      "SELECT table_name,column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND ((table_name='incubation_programs' AND column_name='competition_id') OR (table_name='competitions' AND column_name='kind') OR (table_name='incubation_catalog' AND column_name='variant'))",
    );
    if (
      columns.rows.length !== 3 ||
      !columns.rows.some(
        (r) => r.column_name === "competition_id" && r.is_nullable === "NO",
      )
    )
      throw Error("Incubation Competition upgrade is missing");
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
