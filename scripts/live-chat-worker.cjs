// Run only with restricted portal + CRM runtime URLs. No migrations on startup.
const { PrismaClient: Portal } = require("@prisma/client");
const { PrismaClient: Crm } = require("../generated/customer-service");
const { tick } = require("./lib/live-chat-engine.cjs");
if (!process.env.DATABASE_URL || !process.env.CUSTOMER_SERVICE_DATABASE_URL)
  throw Error("Both runtime databases are required");
const portalUrl = new URL(process.env.DATABASE_URL),
  crmUrl = new URL(process.env.CUSTOMER_SERVICE_DATABASE_URL);
if (portalUrl.host === crmUrl.host && portalUrl.pathname === crmUrl.pathname)
  throw Error("Portal and CRM must be different databases");
const portal = new Portal(),
  crm = new Crm();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function scoped(courseId, workspaceId, fn) {
  return crm.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('crm.course',${courseId},true),set_config('crm.workspace',${workspaceId},true)`;
      return fn(tx);
    },
    { timeout: 15000 },
  );
}
async function cycle() {
  // Courses are the tenant directory; all roster reads get explicit course context.
  const courses = await portal.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_super_admin','true',true)`;
    return tx.course.findMany({
      select: { id: true, status: true, settings: true },
    });
  });
  for (const course of courses) {
    if (stopping) break;
    const snapshots = await portal.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin','false',true),set_config('app.current_course_id',${course.id},true)`;
      const batches = await tx.batch.findMany({
        where: { courseId: course.id },
      });
      const users = await tx.user.findMany({
        where: {
          courseId: course.id,
          deletedAt: null,
          activeSession: { is: { expiresAt: { gt: new Date() } } },
        },
        select: {
          id: true,
          role: true,
          studentRoll: true,
          studentBatchName: true,
          permissions: true,
        },
      });
      const students = await tx.batchStudent.findMany({
        where: {
          courseId: course.id,
          courseStatus: "Running",
          batchType: "Running",
        },
        select: { batchId: true, roll: true },
      });
      return { batches, users, students };
    });
    const workspaces = await scoped(course.id, "", (tx) =>
      tx.workspace.findMany({ where: { courseId: course.id } }),
    );
    for (const w of workspaces) {
      const batch = snapshots.batches.find((b) => b.id === w.batchId);
      const allowed = new Set(
        snapshots.users
          .filter((u) =>
            u.role === "student"
              ? u.studentBatchName === batch?.name &&
                snapshots.students.some(
                  (s) => s.batchId === w.batchId && s.roll === u.studentRoll,
                )
              : u.role === "super_admin" ||
                (Array.isArray(u.permissions) &&
                  (u.permissions.includes("crm_admin") ||
                    u.permissions.includes("crm_supervisor"))),
          )
          .map((u) => u.id),
      );
      await scoped(course.id, w.id, async (tx) => {
        if (
          !(await tx.chatSettings.findUnique({ where: { workspaceId: w.id } }))
        )
          return;
        const states = await tx.chatAgentState.findMany({
          where: { workspaceId: w.id },
          select: { userId: true },
        });
        const assignments = await tx.staffAssignment.findMany({
          where: { workspaceId: w.id },
          select: { userId: true },
        });
        for (const user of snapshots.users) {
          if (
            user.role !== "student" &&
            Array.isArray(user.permissions) &&
            !user.permissions.includes("crm_admin") &&
            !assignments.some((a) => a.userId === user.id)
          )
            allowed.delete(user.id);
        }
        const disable =
          !["ACTIVE", "TRIAL"].includes(course.status) ||
          !course.settings?.features?.crm ||
          !course.settings?.features?.live_chat ||
          !batch ||
          batch.status !== "active" ||
          w.state !== "ACTIVE";
        await tick(
          tx,
          { courseId: course.id, workspaceId: w.id },
          {
            disable,
            ineligible: states
              .filter((a) => !allowed.has(a.userId))
              .map((a) => a.userId),
          },
        );
      });
    }
  }
}
(async () => {
  try {
    while (!stopping) {
      try {
        await cycle();
      } catch (e) {
        console.error("[live-chat-worker] Cycle failed:", e.code || e.name);
        if (process.argv.includes("--once")) process.exitCode = 1;
      }
      if (process.argv.includes("--once")) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } finally {
    await Promise.all([portal.$disconnect(), crm.$disconnect()]);
  }
})().catch(() => {
  console.error("Live Chat worker failed");
  process.exitCode = 1;
});
