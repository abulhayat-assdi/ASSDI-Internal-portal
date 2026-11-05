const fs = require("fs"),
  path = require("path"),
  { spawn } = require("child_process");
const env = {
  ...process.env,
  ...JSON.parse(fs.readFileSync(".crm-test/live-chat-env.json", "utf8")),
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const key of ["DATABASE_URL", "CUSTOMER_SERVICE_DATABASE_URL"]) {
  const u = new URL(env[key]);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "55439" ||
    !u.pathname.endsWith("_test")
  )
    throw Error("Only isolated test databases are allowed");
}
// Pass a separate build directory without changing the production Next config.
Object.assign(process.env, env);
require("module").Module._initPaths();
const next = require("next");
const app = next({
  dev: true,
  port: 3118,
  dir: process.cwd(),
  conf: {
    ...require("../next.config.ts").default,
    distDir: ".crm-test/live-chat-next",
  },
});
Object.assign(process.env, env);
app.prepare().then(() =>
  require("http")
    .createServer(app.getRequestHandler())
    .listen(3118, "127.0.0.1", () =>
      console.log("Live Chat test server on 3118"),
    ),
);
