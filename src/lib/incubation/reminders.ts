import "server-only";
import { withCourseContext } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features";
import { escapeHtml, isMailConfigured, renderEmail, sendMail } from "@/lib/mailer";
import { todayDhaka } from "./domain";
import { incubationState } from "./lifecycle";
import { buildMonitor, type MonitorIssue } from "./monitor";
import { settingsSchema } from "./server";

/**
 * Daily reminder run for every running Business Incubation program.
 *
 * Leads and members get one in-app notification per issue (missing sales,
 * open check-out, handover waiting); staff get one digest per program per
 * day. The (user, eventKey) unique index makes a repeated run harmless.
 * When the course has email notifications on, each person also receives one
 * email listing what is new for them.
 */
export async function runIncubationReminders(today = todayDhaka()) {
  const created: { courseId: string; userId: string; title: string; body: string; link: string }[] = [];

  const courses = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.course.findMany({ select: { id: true, slug: true, name: true, settings: true } }),
  );

  for (const course of courses) {
    if (!isFeatureEnabled(course.settings, "business_incubation")) continue;
    await withCourseContext({ courseId: course.id, isSuperAdmin: false }, async (tx) => {
      const programs = await tx.incubationProgram.findMany({
        where: { courseId: course.id, status: { in: ["active", "closing"] } },
      });
      for (const program of programs) {
        if (!["running", "closing"].includes(incubationState(program, today))) continue;
        const [teams, sprints, records, sessions, corrections, fieldCorrections] = await Promise.all([
          tx.incubationTeam.findMany({ where: { programId: program.id }, include: { members: true } }),
          tx.incubationSprint.findMany({ where: { programId: program.id } }),
          tx.incubationRecord.findMany({
            where: { programId: program.id },
            select: { teamId: true, targetTeamId: true, kind: true, status: true, date: true },
          }),
          tx.incubationFieldSession.findMany({
            where: { programId: program.id, checkOut: null },
            select: { id: true, teamId: true, userId: true, userName: true, checkIn: true, checkOut: true },
          }),
          tx.incubationCorrection.count({ where: { programId: program.id, status: "pending" } }),
          tx.incubationFieldCorrection.count({ where: { programId: program.id, status: "pending" } }),
        ]);
        const issues = buildMonitor({
          today,
          program: { ...program, settings: settingsSchema.parse(program.settings) },
          teams,
          sprints,
          records,
          sessions,
          pendingCorrections: corrections,
          pendingFieldCorrections: fieldCorrections,
        });
        if (!issues.length) continue;

        // Student accounts of each team's current lead.
        const leads = teams.flatMap((t) => t.members.filter((m) => m.isLead).map((m) => ({ teamId: t.id, m })));
        const leadUsers = new Map<string, string>();
        for (const { teamId, m } of leads) {
          const u = await tx.user.findFirst({
            where: {
              courseId: course.id,
              role: "student",
              deletedAt: null,
              studentBatchName: m.batchName,
              studentRoll: m.roll,
            },
            select: { id: true },
          });
          if (u) leadUsers.set(teamId, u.id);
        }
        const staffIds = (program.staffIds as string[]).length
          ? (program.staffIds as string[])
          : (
              await tx.user.findMany({
                where: {
                  courseId: course.id,
                  role: { in: ["admin", "teacher"] },
                  deletedAt: null,
                  isSuperAdminShadow: false,
                },
                select: { id: true },
              })
            ).map((u) => u.id);

        const studentLink = `/student-dashboard/competitions/${program.competitionId}`;
        const staffLink = `/dashboard/competitions/${program.competitionId}`;
        const rows: {
          userId: string;
          eventKey: string;
          kind: string;
          title: string;
          body: string;
          link: string;
        }[] = [];
        const forStudent = (userId: string | undefined, issue: MonitorIssue) => {
          if (!userId) return;
          rows.push({
            userId,
            eventKey: `${program.id}:${issue.key}`,
            kind: issue.kind,
            title: program.name,
            body: issue.text,
            link: studentLink,
          });
        };
        for (const issue of issues) {
          if (issue.audience.includes("lead") && issue.teamId) forStudent(leadUsers.get(issue.teamId), issue);
          if (issue.audience.includes("member") && issue.userId && issue.userId !== leadUsers.get(issue.teamId ?? ""))
            forStudent(issue.userId, issue);
        }
        const staffIssues = issues.filter((i) => i.audience.includes("staff"));
        if (staffIssues.length) {
          for (const userId of staffIds) {
            rows.push({
              userId,
              eventKey: `${program.id}:digest:${today}`,
              kind: "digest",
              title: `${program.name}: আজকের করণীয় (${staffIssues.length})`,
              body: staffIssues.map((i) => `• ${i.text}`).join("\n"),
              link: staffLink,
            });
          }
        }
        if (!rows.length) continue;

        const existing = new Set(
          (
            await tx.incubationNotification.findMany({
              where: { programId: program.id, eventKey: { in: rows.map((r) => r.eventKey) } },
              select: { userId: true, eventKey: true },
            })
          ).map((n) => `${n.userId}|${n.eventKey}`),
        );
        const fresh = rows.filter((r) => !existing.has(`${r.userId}|${r.eventKey}`));
        if (!fresh.length) continue;
        await tx.incubationNotification.createMany({
          data: fresh.map((r) => ({ ...r, courseId: course.id, programId: program.id })),
          skipDuplicates: true,
        });
        created.push(...fresh.map((r) => ({ courseId: course.id, userId: r.userId, title: r.title, body: r.body, link: r.link })));
      }
    });
  }

  const emailed = await emailDigests(courses, created, today);
  return { created: created.length, emailed };
}

async function emailDigests(
  courses: { id: string; slug: string; name: string; settings: unknown }[],
  created: { courseId: string; userId: string; title: string; body: string; link: string }[],
  today: string,
) {
  if (!created.length || !isMailConfigured()) return 0;
  let sent = 0;
  const base = (process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || "tasm-skill.asf.bd").toLowerCase();
  for (const course of courses) {
    if (!isFeatureEnabled(course.settings, "email_notifications")) continue;
    const mine = created.filter((c) => c.courseId === course.id);
    if (!mine.length) continue;
    const byUser = new Map<string, typeof mine>();
    for (const n of mine) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);
    const users = await withCourseContext({ courseId: course.id, isSuperAdmin: false }, (tx) =>
      tx.user.findMany({ where: { id: { in: [...byUser.keys()] }, deletedAt: null }, select: { id: true, email: true } }),
    );
    for (const u of users) {
      const items = byUser.get(u.id) ?? [];
      if (!u.email?.includes("@") || !items.length) continue;
      const html = renderEmail({
        courseName: course.name,
        heading: "Business Incubation — আজকের করণীয়",
        bodyHtml: items
          .map(
            (i) =>
              `<p style="margin:0 0 6px;"><b>${escapeHtml(i.title)}</b></p><p style="margin:0 0 14px;white-space:pre-line;">${escapeHtml(i.body)}</p>`,
          )
          .join(""),
        ctaLabel: "পোর্টালে দেখুন",
        ctaUrl: `https://${course.slug}.${base}${items[0].link}`,
      });
      try {
        if (await sendMail({ courseName: course.name, subject: `Business Incubation রিমাইন্ডার — ${today}`, html, to: [u.email] })) {
          sent++;
          await withCourseContext({ courseId: course.id, isSuperAdmin: false }, (tx) =>
            tx.incubationNotification.updateMany({
              where: { userId: u.id, emailedAt: null, createdAt: { gte: new Date(Date.now() - 3600_000) } },
              data: { emailedAt: new Date() },
            }),
          );
        }
      } catch (error) {
        console.error("[incubation] reminder email failed:", error instanceof Error ? error.message : error);
      }
    }
  }
  return sent;
}
