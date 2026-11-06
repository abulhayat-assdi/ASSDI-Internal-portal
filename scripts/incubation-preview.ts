/** Disposable local review server. No production URL or credentials are used. */
import { startIncubationTestDatabase } from "../test/incubation-database";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
async function main() {
  const fixture = await startIncubationTestDatabase(55441),
    prisma = new PrismaClient({ datasourceUrl: fixture.url });
  const secret = "incubation-local-preview-secret-for-disposable-tests-only";
  await prisma.course.create({
    data: {
      id: "preview-course",
      slug: "incubation",
      name: "Sales & Marketing",
      settings: { features: { business_incubation: true } },
    },
  });
  await prisma.batch.create({
    data: {
      id: "preview-batch",
      courseId: "preview-course",
      name: "Sales Batch 12",
    },
  });
  for (const [id, role, roll, name] of [
    ["preview-admin", "admin", "", "Program Administrator"],
    ["preview-teacher", "teacher", "", "Program Teacher"],
    ["preview-lead", "student", "1", "Team Leader"],
    ["preview-member", "student", "2", "Team Member"],
    ["preview-target", "student", "3", "Team Two Leader"],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        courseId: "preview-course",
        email: `${id}@test.local`,
        displayName: name,
        passwordHash: "unused",
        role,
        studentBatchName: roll ? "Sales Batch 12" : null,
        studentRoll: roll || null,
      },
    });
    await prisma.activeSession.create({
      data: { userId: id, expiresAt: new Date(Date.now() + 86400000) },
    });
    if (roll)
      await prisma.batchStudent.create({
        data: {
          id: `student-${roll}`,
          courseId: "preview-course",
          batchId: "preview-batch",
          batchName: "Sales Batch 12",
          roll,
          name,
        },
      });
  }
  const adminToken = await new SignJWT({
    id: "preview-admin",
    email: "preview-admin@test.local",
    displayName: "Program Administrator",
    role: "admin",
    courseId: "preview-course",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(secret));
  const studentToken = await new SignJWT({
    id: "preview-lead",
    email: "preview-lead@test.local",
    displayName: "Team Leader",
    role: "student",
    courseId: "preview-course",
    studentBatchName: "Sales Batch 12",
    studentRoll: "1",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(secret));
  const otherTokens: Record<string, string> = {};
  for (const [key, id, role, roll] of [
    ["teacherToken", "preview-teacher", "teacher", ""],
    ["memberToken", "preview-member", "student", "2"],
    ["targetToken", "preview-target", "student", "3"],
  ])
    otherTokens[key] = await new SignJWT({
      id,
      email: id + "@test.local",
      displayName: id,
      role,
      courseId: "preview-course",
      ...(roll
        ? { studentBatchName: "Sales Batch 12", studentRoll: roll }
        : {}),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(new TextEncoder().encode(secret));
  mkdirSync(".incubation-test", { recursive: true });
  writeFileSync(
    ".incubation-test/preview.json",
    JSON.stringify({
      origin: "http://incubation.localhost:3105",
      adminToken,
      studentToken,
      ...otherTokens,
    }),
  );
  await prisma.$disconnect();
  await fixture.db.exec("DEALLOCATE ALL");
  const child = spawn(
    process.execPath,
    [path.resolve("node_modules/next/dist/bin/next"), "dev", "--port", "3105"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: fixture.url,
        CUSTOMER_SERVICE_DATABASE_URL: fixture.url,
        JWT_SECRET: secret,
        AUTH_PROFILE_CACHE_MS: "0",
        AUTH_OVERRIDE_CACHE_MS: "0",
        LOCAL_STORAGE_PATH: path.resolve(".incubation-test/uploads"),
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  );
  console.log(
    "Disposable preview: http://incubation.localhost:3105 (credentials in ignored .incubation-test/preview.json)",
  );
  const stop = async () => {
    child.kill();
    await prisma.$disconnect();
    await fixture.stop();
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  child.on("exit", () => void stop());
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
