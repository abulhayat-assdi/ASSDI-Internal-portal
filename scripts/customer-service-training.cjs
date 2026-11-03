// Explicit one-shot release task. No credentials or customer data are printed.
// node scripts/customer-service-training.cjs --course telesales [--enroll-agents]
const { loadPracticeDataset } = require("./lib/customer-service-practice.cjs");
const { PrismaClient: Crm } = require("../generated/customer-service");
const { PrismaClient: Portal } = require("@prisma/client");
const args = process.argv.slice(2);
const courseSlug = args[args.indexOf("--course") + 1];
if (!args.includes("--course") || !courseSlug || courseSlug.startsWith("--"))
  throw Error("An explicit --course slug is required");
if (process.env.DB_HOST && process.env.DB_NAME && process.env.APP_DB_PASSWORD) {
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(process.env.APP_DB_USER || "asm_app")}:${encodeURIComponent(process.env.APP_DB_PASSWORD)}@${process.env.DB_HOST}:5432/${encodeURIComponent(process.env.DB_NAME)}`;
}
const portalUrl = new URL(process.env.DATABASE_URL);
const crmUrl = new URL(process.env.CUSTOMER_SERVICE_DATABASE_URL);
if (portalUrl.host === crmUrl.host && portalUrl.pathname === crmUrl.pathname)
  throw Error("CRM must use a separate database");
const portal = new Portal(),
  crm = new Crm();
(async () => {
  const course = await portal.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
    return tx.course.findUnique({ where: { slug: courseSlug } });
  });
  if (!course || course.settings?.features?.crm !== true)
    throw Error("An existing CRM-enabled course is required");
  const administrator = await portal.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_course_id', ${course.id}, true), set_config('app.is_super_admin', 'false', true)`;
    return tx.user.findFirst({
      where: { courseId: course.id, role: "admin", deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, displayName: true },
    });
  });
  if (!administrator)
    throw Error("An existing course administrator is required");
  const workspaces = await crm.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('crm.course', ${course.id}, true), set_config('crm.workspace', '', true)`;
    return tx.workspace.findMany({
      where: { courseId: course.id, state: "ACTIVE" },
    });
  });
  if (!workspaces.length) throw Error("No active CRM workspaces found");
  for (const w of workspaces) {
    const eligible = args.includes("--enroll-agents")
      ? await portal.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_course_id', ${course.id}, true), set_config('app.is_super_admin', 'false', true)`;
          const batch = await tx.batch.findFirst({
            where: { id: w.batchId, courseId: course.id, status: "active" },
          });
          if (!batch) return [];
          const roster = await tx.batchStudent.findMany({
            where: {
              courseId: course.id,
              batchId: batch.id,
              courseStatus: { notIn: ["Incomplete", "Expelled"] },
            },
            select: { roll: true },
          });
          return tx.user.findMany({
            where: {
              courseId: course.id,
              role: "student",
              deletedAt: null,
              studentBatchName: batch.name,
              studentRoll: { in: roster.map((r) => r.roll) },
            },
            select: { id: true },
          });
        })
      : [];
    const result = await crm.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('crm.course', ${course.id}, true), set_config('crm.workspace', ${w.id}, true)`;
        const scope = { courseId: course.id, workspaceId: w.id };
        const before = await tx.complaint.count();
        const training = await loadPracticeDataset(tx, scope, {
          id: administrator.id,
          name: administrator.displayName,
        });
        const members = eligible.length
          ? await tx.member.createMany({
              data: eligible.map((u) => ({
                ...scope,
                userId: u.id,
                role: "AGENT",
                active: true,
              })),
              skipDuplicates: true,
            })
          : { count: 0 };
        if ((await tx.complaint.count()) !== before + training.complaintsAdded)
          throw Error("Unexpected practice complaint count");
        await tx.audit.create({
          data: {
            ...scope,
            actorId: "crm-training-release",
            actorName: "CRM training setup",
            action: "training.release",
            data: { ...training, agentsAdded: members.count },
          },
        });
        return {
          workspace: w.name,
          ...training,
          agentsAdded: members.count,
          previousComplaints: before,
        };
      },
      { timeout: 30000 },
    );
    console.log(JSON.stringify(result));
  }
})()
  .catch(() => {
    console.error(
      "Training setup failed. Check the scoped configuration; no credentials are logged.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await crm.$disconnect();
    await portal.$disconnect();
  });
