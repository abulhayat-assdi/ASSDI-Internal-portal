import "server-only";
import { NextRequest } from "next/server";
import {
  identity,
  workspaceAccess,
  type Identity,
} from "@/lib/customer-service/access";
import { scoped, CrmError, type Tx } from "@/lib/customer-service/db";
import { withCourseContext } from "@/lib/db";
import {
  extractCourseSlug,
  getCourseBySlug,
  isCourseUsable,
} from "@/lib/course";
import { isFeatureEnabled } from "@/lib/features";
import { createHash, randomBytes } from "node:crypto";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export function need(
  condition: unknown,
  message: string,
  status = 403,
): asserts condition {
  if (!condition) throw new CrmError(status, message);
}
export async function chatIdentity(req: NextRequest) {
  const ctx = await identity(req);
  const course = await publicCourse(req);
  need(course.id === ctx.courseId, "Course mismatch");
  if (!ctx.staff) await studentEligible(ctx);
  return ctx;
}
export async function studentEligible(ctx: Identity) {
  const valid = await withCourseContext(
    { courseId: ctx.courseId, isSuperAdmin: false },
    async (tx) => {
      const batch = await tx.batch.findFirst({
        where: { id: ctx.batchId, courseId: ctx.courseId, status: "active" },
      });
      const student = await tx.batchStudent.findFirst({
        where: {
          courseId: ctx.courseId,
          batchId: ctx.batchId,
          roll: ctx.user.studentRoll || "",
          courseStatus: "Running",
          batchType: "Running",
        },
      });
      return batch && student;
    },
  );
  need(
    valid,
    "Live Chat access ends when your batch or enrollment is completed. / ব্যাচ শেষে লাইভ চ্যাট অ্যাক্সেস বন্ধ।",
  );
}
export function access<T>(
  ctx: Identity,
  workspaceId: string,
  write: boolean,
  fn: Parameters<typeof workspaceAccess<T>>[3],
) {
  return workspaceAccess(ctx, workspaceId, write, fn);
}
export async function publicCourse(req: NextRequest) {
  const slug = extractCourseSlug(
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "",
  );
  const course = slug ? await getCourseBySlug(slug) : null;
  need(
    course &&
      isCourseUsable(course) &&
      isFeatureEnabled(course.settings, "crm") &&
      isFeatureEnabled(course.settings, "live_chat"),
    "Live Chat is unavailable for this course",
    404,
  );
  return course;
}
export async function linkAccess<T>(
  req: NextRequest,
  token: string,
  fn: (
    tx: Tx,
    link: {
      id: string;
      courseId: string;
      workspaceId: string;
      sessionId: string | null;
      active: boolean;
      expiresAt: Date;
    },
    session: Awaited<ReturnType<Tx["chatTrainingSession"]["findFirst"]>>,
  ) => Promise<T>,
  newChat = false,
) {
  const course = await publicCourse(req);
  const [workspaceId, key] = token.split(".");
  need(
    workspaceId && key && key.length >= 40 && token.length < 200,
    "Invalid chat link",
    404,
  );
  // Token is looked up only after scope comes from its workspace and the verified course host.
  return scoped(course.id, workspaceId, async (tx) => {
    const link = await tx.chatPublicLink.findFirst({
      where: { workspaceId, tokenHash: hash(token) },
    });
    need(link, "Chat link not found", 404);
    const workspace = await tx.workspace.findFirst({
      where: { id: workspaceId, state: "ACTIVE" },
    });
    need(workspace, "Workspace is unavailable", 404);
    const session = link.sessionId
      ? await tx.chatTrainingSession.findFirst({
          where: { id: link.sessionId, workspaceId },
        })
      : null;
    if (newChat) {
      need(
        link.active && link.expiresAt > new Date(),
        "This chat link is paused or expired",
        410,
      );
      need(
        !session ||
          (session.state === "OPEN" &&
            session.startsAt <= new Date() &&
            (!session.endsAt || session.endsAt > new Date())),
        "Training session is not accepting chats",
        409,
      );
      const batch = await withCourseContext(
        { courseId: course.id, isSuperAdmin: false },
        (p) =>
          p.batch.findFirst({
            where: { id: workspace.batchId, status: "active" },
          }),
      );
      need(batch, "This batch has ended", 410);
    }
    return fn(tx, link, session);
  });
}
export async function customer(
  tx: Tx,
  workspaceId: string,
  token: string,
  linkId: string,
) {
  need(token && token.length < 100, "Customer session required", 401);
  const session = await tx.chatCustomerSession.findFirst({
    where: {
      workspaceId,
      tokenHash: hash(linkId + ":" + token),
      expiresAt: { gt: new Date() },
    },
  });
  need(session, "Your chat session expired", 401);
  return session;
}
