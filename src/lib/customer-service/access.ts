import "server-only";
import { NextRequest } from "next/server";
import { getSessionUser, hasRequiredPermission } from "@/lib/auth";
import {
  extractCourseSlug,
  getCourseBySlug,
  isCourseUsable,
} from "@/lib/course";
import { isFeatureEnabled } from "@/lib/features";
import { isBlockingStatus } from "@/lib/studentAccess";
import { withCourseContext } from "@/lib/db";
import { scoped, CrmError, Tx } from "./db";
import { Actor } from "./domain";
export async function identity(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user?.courseId) throw new CrmError(401, "Sign in on your course portal");
  const slug = extractCourseSlug(
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "",
  );
  const course = slug ? await getCourseBySlug(slug) : null;
  if (
    !course ||
    course.id !== user.courseId ||
    !isCourseUsable(course) ||
    !isFeatureEnabled(course.settings, "crm")
  )
    throw new CrmError(403, "CRM is unavailable for this course");
  const admin =
    user.role !== "student" && hasRequiredPermission(user, "crm_admin");
  const staff =
    user.role !== "student" &&
    (admin || hasRequiredPermission(user, "crm_supervisor"));
  if (user.role !== "student" && !staff)
    throw new CrmError(403, "CRM permission required");
  const batch =
    user.role === "student"
      ? await withCourseContext(
          { courseId: course.id, isSuperAdmin: false },
          (tx) =>
            tx.batchStudent.findFirst({
              where: {
                courseId: course.id,
                batchName: user.studentBatchName || "",
                roll: user.studentRoll || "",
              },
              select: { batchId: true, courseStatus: true },
            }),
        )
      : null;
  if (
    user.role === "student" &&
    (!batch || isBlockingStatus(batch.courseStatus))
  )
    throw new CrmError(403, "Current batch enrollment is required");
  return { user, courseId: course.id, admin, staff, batchId: batch?.batchId };
}
export type Identity = Awaited<ReturnType<typeof identity>>;
export async function workspaceAccess<T>(
  ctx: Identity,
  id: string,
  write: boolean,
  fn: (tx: Tx, actor: Actor) => Promise<T>,
) {
  return scoped(ctx.courseId, id, async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: { id, courseId: ctx.courseId },
    });
    if (
      !workspace ||
      (workspace.state === "ARCHIVED" && !ctx.admin) ||
      (ctx.batchId && workspace.batchId !== ctx.batchId)
    )
      throw new CrmError(403, "Workspace access denied");
    if (write && workspace.state !== "ACTIVE")
      throw new CrmError(409, "Workspace is read-only");
    let actor: Actor = {
      id: ctx.user.id,
      name: ctx.user.displayName,
      role: ctx.admin ? "ADMIN" : "SUPERVISOR",
    };
    if (ctx.staff) {
      if (
        !ctx.admin &&
        !(await tx.staffAssignment.findFirst({
          where: { workspaceId: id, userId: ctx.user.id },
        }))
      )
        throw new CrmError(403, "This workspace is not assigned to you");
    } else {
      const member = await tx.member.findUnique({
        where: { workspaceId_userId: { workspaceId: id, userId: ctx.user.id } },
      });
      if (!member?.active)
        throw new CrmError(403, "Active CRM membership required");
      if (member.role !== "AGENT") {
        const team = member.teamId
          ? await tx.team.findFirst({
              where: {
                id: member.teamId,
                workspaceId: id,
                active: true,
                tier: member.role,
              },
            })
          : null;
        if (!team)
          throw new CrmError(403, "An active escalation team is required");
      }
      actor = {
        ...actor,
        role: member.role as Actor["role"],
        teamId: member.teamId,
      };
    }
    return fn(tx, actor);
  });
}
export async function portalRoster(ctx: Identity, batchId?: string) {
  return withCourseContext(
    { courseId: ctx.courseId, isSuperAdmin: false },
    async (tx) => {
      const batch = batchId
        ? await tx.batch.findFirst({
            where: { id: batchId, courseId: ctx.courseId },
          })
        : null;
      const users = await tx.user.findMany({
        where: {
          courseId: ctx.courseId,
          deletedAt: null,
          ...(batch
            ? {
                OR: [
                  { role: "student", studentBatchName: batch.name },
                  { role: { in: ["teacher", "admin"] } },
                ],
              }
            : { role: { in: ["teacher", "admin"] } }),
        },
        select: {
          id: true,
          displayName: true,
          role: true,
          studentBatchName: true,
          studentRoll: true,
        },
        take: 2000,
      });
      if (!batch) return users;
      const eligible = await tx.batchStudent.findMany({
        where: {
          courseId: ctx.courseId,
          batchId: batch.id,
          courseStatus: { notIn: ["Incomplete", "Expelled"] },
        },
        select: { roll: true },
      });
      const rolls = new Set(eligible.map((s) => s.roll));
      return users.filter(
        (u) =>
          u.role !== "student" || (u.studentRoll && rolls.has(u.studentRoll)),
      );
    },
  );
}
