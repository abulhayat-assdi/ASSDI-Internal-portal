const { spawnSync } = require("node:child_process");
const url = process.env.CUSTOMER_SERVICE_MIGRATION_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL)
  throw new Error("A separate CRM migration URL is required");
if (process.env.DATABASE_URL) {
  const portal = new URL(process.env.DATABASE_URL),
    crm = new URL(url);
  if (portal.host === crm.host && portal.pathname === crm.pathname)
    throw new Error("CRM migration must not target the portal database");
}
const result = spawnSync(
  process.execPath,
  [
    require.resolve("prisma/build/index.js"),
    "migrate",
    "deploy",
    "--schema",
    "prisma/customer-service/schema.prisma",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, CUSTOMER_SERVICE_DATABASE_URL: url },
  },
);
process.exit(result.status ?? 1);
