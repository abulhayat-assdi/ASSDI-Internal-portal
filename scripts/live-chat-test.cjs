// Isolated existing disposable databases only. Does not read project .env.
const fs = require("fs"),
  { spawnSync } = require("child_process"),
  { randomBytes } = require("crypto");
const password = fs.readFileSync(".crm-test/password", "utf8").trim();
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:55439/portal_test`,
  CUSTOMER_SERVICE_DATABASE_URL: `postgresql://crm_runtime:${encodeURIComponent(password)}@127.0.0.1:55439/crm_test`,
  CUSTOMER_SERVICE_MIGRATION_DATABASE_URL: `postgresql://postgres:${encodeURIComponent(password)}@127.0.0.1:55439/crm_test`,
  JWT_SECRET: randomBytes(32).toString("hex"),
  CRM_INTEGRATION: "1",
};
if (process.argv.includes("--browser-fixture")) {
  env.LIVE_CHAT_BROWSER_FIXTURE = "1";
  fs.writeFileSync(
    ".crm-test/live-chat-env.json",
    JSON.stringify({
      DATABASE_URL: env.DATABASE_URL,
      CUSTOMER_SERVICE_DATABASE_URL: env.CUSTOMER_SERVICE_DATABASE_URL,
      JWT_SECRET: env.JWT_SECRET,
    }),
  );
}
for (const args of [
  ["scripts/customer-service-migrate.cjs"],
  ["scripts/customer-service-migrate.cjs"],
  ["scripts/customer-service-role.cjs"],
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "src/lib/live-chat",
    ...(process.argv.includes('--regression')?['src/lib/customer-service']:[]),
    "--exclude",
    ".worktrees/**",
  ],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
