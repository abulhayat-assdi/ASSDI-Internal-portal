const fs = require("fs"),
  { spawn } = require("child_process");
const env = {
  ...process.env,
  ...JSON.parse(fs.readFileSync(".crm-test/env.json", "utf8")),
  NEXT_TELEMETRY_DISABLED: "1",
};

for (const key of ["DATABASE_URL", "CUSTOMER_SERVICE_DATABASE_URL"]) {
  const u = new URL(env[key]);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "55439" ||
    !u.pathname.endsWith("_test")
  )
    throw Error("Only isolated local test databases are allowed");
}
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", "3107"],
  { env, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
