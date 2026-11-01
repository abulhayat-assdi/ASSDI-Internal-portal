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
  { SignJWT } = require("jose");
(async () => {
  const p = new PrismaClient();
  const course = await p.course.findFirst({
    where: { slug: { startsWith: "crm-" } },
    orderBy: { createdAt: "desc" },
  });
  const users = await p.user.findMany({ where: { courseId: course.id } });
  const sessions = {};
  for (const u of users) {
    await p.activeSession.upsert({
      where: { userId: u.id },
      create: { userId: u.id, expiresAt: new Date(Date.now() + 3600000) },
      update: { expiresAt: new Date(Date.now() + 3600000) },
    });
    sessions[u.id.split("-")[0]] = await new SignJWT({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      courseId: u.courseId,
      studentBatchName: u.studentBatchName,
      studentRoll: u.studentRoll,
      permissions: u.permissions,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  }
  fs.writeFileSync(
    ".crm-test/browser.json",
    JSON.stringify({ host: course.slug + ".localhost", sessions }),
  );
  await p.$disconnect();
  console.log("Local browser fixture sessions prepared.");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
