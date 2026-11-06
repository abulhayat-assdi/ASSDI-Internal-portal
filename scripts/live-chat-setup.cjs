// Explicit operator setup. No production secrets are written to files or logs.
const { spawnSync } = require("node:child_process");
const { PrismaClient: Portal } = require("@prisma/client");
const { PrismaClient: Crm } = require("../generated/customer-service");
const { seedPractice } = require("./lib/live-chat-practice.cjs");
const { lock } = require("./lib/live-chat-engine.cjs");
const args = process.argv.slice(2),
  seed = args.includes("--seed"),
  migrate = args.includes("--migrate");
const courseArg = args.indexOf("--course"),
  slug = courseArg >= 0 ? args[courseArg + 1] : null;
if (!process.env.DATABASE_URL || !process.env.CUSTOMER_SERVICE_DATABASE_URL)
  throw Error("Both portal and CRM runtime URLs are required.");
const p = new URL(process.env.DATABASE_URL),
  c = new URL(process.env.CUSTOMER_SERVICE_DATABASE_URL);
if (p.host === c.host && p.pathname === c.pathname)
  throw Error("CRM must use database 2, not the portal database.");
if (migrate) {
  if (!process.env.CUSTOMER_SERVICE_MIGRATION_DATABASE_URL)
    throw Error(
      "Supply the CRM migration owner URL only to this one-shot job.",
    );
  for (const file of [
    "scripts/customer-service-migrate.cjs",
    "scripts/customer-service-role.cjs",
  ]) {
    const r = spawnSync(process.execPath, [file], {
      stdio: "inherit",
      env: process.env,
    });
    if (r.status !== 0) process.exit(r.status || 1);
  }
}
const portal = new Portal(),
  crm = new Crm();
async function scoped(courseId, workspaceId, fn) {
  return crm.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('crm.course',$1,true),set_config('crm.workspace',$2,true)",
        courseId,
        workspaceId,
      );
      return fn(tx);
    },
    { timeout: 30000 },
  );
}
(async () => {
  try {
    const tables = [
      "ChatSettings",
      "ChatCategory",
      "ChatTrainingSession",
      "ChatPublicLink",
      "ChatAgentState",
      "ChatCustomerSession",
      "ChatConversation",
      "ChatMessage",
      "ChatAssignment",
      "ChatEvent",
      "ChatQaEvaluation",
      "ChatReference",
      "ChatRateBucket",
    ];
    const missing = [];
    for (const table of tables) {
      const result = await crm.$queryRawUnsafe(
        "SELECT to_regclass($1) IS NOT NULL AS ready",
        'public."' + table + '"',
      );
      if (!result[0].ready) missing.push(table);
    }
    if (missing.length)
      throw Object.assign(
        Error(
          "Chat tables are missing. Run with --migrate using the CRM owner connection, then rerun this check.",
        ),
        { code: "CHAT_DATABASE_SETUP_REQUIRED" },
      );
    const columns = await crm.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ChatConversation'",
    );
    if (
      ![
        "practiceKey",
        "practiceStep",
        "practiceStartedAt",
        "practiceScript",
        "policySnapshot",
      ].every((name) => columns.some((c) => c.column_name === name))
    )
      throw Object.assign(
        Error(
          "Chat migrations are incomplete. Run the latest CRM migrations and runtime grants.",
        ),
        { code: "CHAT_DATABASE_SETUP_REQUIRED" },
      );
    const role = await crm.$queryRawUnsafe(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    );
    if (role[0].rolsuper || role[0].rolbypassrls)
      throw Error(
        "The CRM web/worker URL must use the restricted runtime role.",
      );
    for (const table of tables) {
      const permissions = await crm.$queryRawUnsafe(
        "SELECT has_table_privilege(current_user,$1,'SELECT') AND has_table_privilege(current_user,$1,'INSERT') AS ready",
        'public."' + table + '"',
      );
      if (!permissions[0].ready)
        throw Error(
          "CRM runtime grants are incomplete. Run customer-service-role.cjs with the CRM owner connection.",
        );
    }
    const seq = await crm.$queryRawUnsafe(
      `SELECT has_sequence_privilege(current_user,pg_get_serial_sequence('"ChatMessage"','sequence'),'USAGE') AS ready`,
    );
    if (!seq[0].ready)
      throw Error(
        "Chat message sequence grants are incomplete. Run customer-service-role.cjs.",
      );
    console.log("Live Chat database schema and runtime role: ready");
    if (!seed) return;
    const courses = await portal.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.is_super_admin','true',true)",
      );
      return tx.course.findMany({ where: slug ? { slug } : {} });
    });
    if (slug && !courses.length) throw Error("Course not found.");
    for (const course of courses) {
      if (
        !course.settings?.features?.crm ||
        !course.settings?.features?.live_chat ||
        !["ACTIVE", "TRIAL"].includes(course.status)
      )
        continue;
      const batches = await portal.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.is_super_admin','false',true),set_config('app.current_course_id',$1,true)",
          course.id,
        );
        return tx.batch.findMany({
          where: { courseId: course.id, status: "active" },
          select: { id: true },
        });
      });
      const ws = await scoped(course.id, "", (tx) =>
        tx.workspace.findMany({
          where: {
            courseId: course.id,
            state: "ACTIVE",
            batchId: { in: batches.map((b) => b.id) },
          },
        }),
      );
      for (const w of ws) {
        const result = await scoped(course.id, w.id, async (tx) => {
          await lock(tx, w.id);
          const cfg = await tx.chatSettings.findUnique({
            where: { workspaceId: w.id },
          });
          return seedPractice(
            tx,
            { courseId: course.id, workspaceId: w.id },
            cfg?.value || {},
          );
        });
        console.log(
          JSON.stringify({ course: course.slug, workspaceId: w.id, ...result }),
        );
      }
    }
  } finally {
    await Promise.all([portal.$disconnect(), crm.$disconnect()]);
  }
})().catch((e) => {
  console.error(
    "Live Chat setup failed:",
    e.code || e.name,
    e.code === "CHAT_DATABASE_SETUP_REQUIRED"
      ? e.message
      : "Check the database configuration, migrations and runtime grants.",
  );
  process.exitCode = 1;
});
