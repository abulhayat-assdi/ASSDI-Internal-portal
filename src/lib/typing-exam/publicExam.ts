import "server-only";
import { withCourseContext } from "@/lib/db";

/**
 * Resolves a public typing exam by its globally-unique slug (RLS bypass,
 * mirrors the student-form/[slug] precedent). `requireOpen` additionally
 * checks it is takeable right now — used to START a run. A run already in
 * progress is finished against `requireOpen: false`, so an exam closing (or
 * its schedule ending) mid-run never throws away a taker's result.
 */
export async function resolvePublicExam(slug: string, { requireOpen }: { requireOpen: boolean }) {
  const exam = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.typingExam.findUnique({ where: { publicSlug: slug } })
  );
  if (!exam) return { ok: false as const, status: 404, error: "not_found" };
  if (exam.accessType !== "PUBLIC") return { ok: false as const, status: 403, error: "not_public" };
  if (requireOpen) {
    if (!exam.isActive) return { ok: false as const, status: 403, error: "not_active" };
    const now = new Date();
    if (exam.scheduleStart && now < exam.scheduleStart) {
      return { ok: false as const, status: 403, error: "not_started" };
    }
    if (exam.scheduleEnd && now > exam.scheduleEnd) {
      return { ok: false as const, status: 403, error: "ended" };
    }
  }
  return { ok: true as const, exam };
}
