const fs = require("fs");
Object.assign(
  process.env,
  JSON.parse(fs.readFileSync(".crm-test/env.json", "utf8")),
);

for (const key of ["DATABASE_URL", "CUSTOMER_SERVICE_DATABASE_URL"]) {
  const u = new URL(process.env[key]);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "55439" ||
    !u.pathname.endsWith("_test")
  )
    throw Error("Only isolated local test databases are allowed");
}
const { PrismaClient } = require("@prisma/client"),
  bcrypt = require("bcryptjs"),
  { randomBytes } = require("crypto");
(async () => {
  const p = new PrismaClient();
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8")),
    course = await p.course.findUnique({
      where: { slug: f.host.split(".")[0] },
    }),
    password = randomBytes(18).toString("hex");
  const users = await p.user.findMany({ where: { courseId: course.id } });
  await p.user.updateMany({
    where: { courseId: course.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  fs.writeFileSync(
    ".crm-test/login.json",
    JSON.stringify({
      password,
      agent: users.find((u) => u.id.startsWith("agent-")).email,
      admin: users.find((u) => u.role === "admin").email,
    }),
  );
  await p.$disconnect();
  console.log("Isolated login fixtures prepared.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
