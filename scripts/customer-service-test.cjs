const fs = require("fs"),
  { spawnSync } = require("child_process"),
  { randomBytes } = require("crypto");
// This runner ONLY targets the disposable local test databases. It never reads .env.
const password = fs.readFileSync(".crm-test/password", "utf8").trim();
const env = {
  ...process.env,
  DATABASE_URL:
    "postgresql://postgres:" + password + "@127.0.0.1:55439/portal_test",
  CUSTOMER_SERVICE_DATABASE_URL:
    "postgresql://crm_runtime:" + password + "@127.0.0.1:55439/crm_test",
  CUSTOMER_SERVICE_MIGRATION_DATABASE_URL:
    "postgresql://postgres:" + password + "@127.0.0.1:55439/crm_test",
  JWT_SECRET: randomBytes(32).toString("hex"),
  CRM_INTEGRATION: "1",
};
fs.writeFileSync(
  ".crm-test/env.json",
  JSON.stringify({
    DATABASE_URL: env.DATABASE_URL,
    CUSTOMER_SERVICE_DATABASE_URL: env.CUSTOMER_SERVICE_DATABASE_URL,
    JWT_SECRET: env.JWT_SECRET,
  }),
);
function run(args, overrides = {}) {
  const r = spawnSync(process.execPath, args, {
    env: { ...env, ...overrides },
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run([
  "node_modules/prisma/build/index.js",
  "generate",
  "--schema",
  "prisma/schema.prisma",
]);
run([
  "node_modules/prisma/build/index.js",
  "db",
  "push",
  "--schema",
  "prisma/schema.prisma",
  "--skip-generate",
]);
run([
  "node_modules/prisma/build/index.js",
  "generate",
  "--schema",
  "prisma/customer-service/schema.prisma",
]);
run(["scripts/customer-service-migrate.cjs"]);
run(["scripts/customer-service-migrate.cjs"]);
run(["scripts/customer-service-role.cjs"]);
run(["node_modules/vitest/vitest.mjs", "run", "src/lib/customer-service", "--exclude", ".worktrees/**"]);
