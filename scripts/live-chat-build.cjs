// Production compiler against disposable local databases, in an isolated output directory.
const fs = require("fs"),
  path = require("path");
const fixture = JSON.parse(
  fs.readFileSync(".crm-test/live-chat-env.json", "utf8"),
);
for (const key of ["DATABASE_URL", "CUSTOMER_SERVICE_DATABASE_URL"]) {
  const u = new URL(fixture[key]);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "55439" ||
    !u.pathname.endsWith("_test")
  )
    throw Error("Only isolated test databases allowed");
}
Object.assign(process.env, fixture, {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
});
require("module").Module._initPaths();
(async () => {
  const { PHASE_PRODUCTION_BUILD } = require("next/constants");
  const config = await require("next/dist/server/config").default(
    PHASE_PRODUCTION_BUILD,
    process.cwd(),
  );
  config.distDir = ".crm-test/live-chat-build";
  config.experimental.cpus = 2;
  config.outputFileTracingRoot = process.cwd();
  // Next's webpack child reloads next.config.ts and loses the isolated distDir.
  // Keep the compiler in this process so the normalized test config is respected.
  config.experimental.webpackBuildWorker = false;
  // Build reuses the normalized configuration cache; production config stays unchanged.
  await require("next/dist/build").default(
    process.cwd(),
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    "default",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
