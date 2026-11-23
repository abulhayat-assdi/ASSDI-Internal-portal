import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { getSessionUser, hasRequiredPermission, type JWTPayload } from "@/lib/auth";
import { extractCourseSlug, getCourseBySlug, isCourseUsable } from "@/lib/course";
import { isFeatureEnabled } from "@/lib/features";
import { isBlockingStatus } from "@/lib/studentAccess";
import { withCourseContext } from "@/lib/db";

/**
 * Bangla Pronunciation app (separate container, served at /pronunciation on
 * the same course host). The portal decides who may open it and hands the
 * person over with a short-lived signed token; the app trusts that token.
 * Contract: docs/pronunciation-integration-spec.md §4 — keep the two in step.
 */

export const PRONUNCIATION_FEATURE = "pronunciation";
export const PRONUNCIATION_BASE_PATH = "/pronunciation";
const TOKEN_TTL_SECONDS = 60;

export type PronunciationRole = "trainee" | "trainer" | "admin";

export type LaunchResult =
  | { ok: true; location: string }
  | { ok: false; reason: "signed_out"; loginPath: string }
  | { ok: false; reason: "denied"; status: number; message: string };

export interface LaunchClaims {
  sub: string;
  course_id: string;
  role: PronunciationRole;
  name: string;
  email: string;
  mobile?: string;
  batch?: string;
  roll?: string;
}

/** Which app role a portal user gets, or null when they may not open it at all. */
export function pronunciationRoleFor(user: JWTPayload): PronunciationRole | null {
  if (user.role === "student") return "trainee";
  if (hasRequiredPermission(user, "pronunciation_admin")) return "admin";
  if (hasRequiredPermission(user, "pronunciation_trainer")) return "trainer";
  return null;
}

function ssoSecret(): Uint8Array {
  const secret = process.env.PRONUNCIATION_SSO_SECRET || "";
  if (secret.length < 32) {
    throw new Error("PRONUNCIATION_SSO_SECRET is not set (needs at least 32 characters).");
  }
  return new TextEncoder().encode(secret);
}

export async function signLaunchToken(claims: LaunchClaims, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  const body: Record<string, string> = { course_id: claims.course_id, role: claims.role, name: claims.name, email: claims.email };
  if (claims.mobile) body.mobile = claims.mobile;
  if (claims.batch) body.batch = claims.batch;
  if (claims.roll) body.roll = claims.roll;
  return new SignJWT(body)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("asm-portal")
    .setAudience("pronunciation")
    .setSubject(claims.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + TOKEN_TTL_SECONDS)
    .setJti(randomUUID())
    .sign(ssoSecret());
}

/**
 * Works out whether the signed-in user may open the app from this course host
 * and, if so, where to send the browser. `asStaff` only picks which login page
 * a signed-out visitor is sent to.
 */
export async function buildLaunch(req: NextRequest, asStaff: boolean): Promise<LaunchResult> {
  const loginPath = asStaff ? "/login" : "/student-login";
  const user = await getSessionUser(req);
  if (!user?.courseId || user.role === "super_admin") return { ok: false, reason: "signed_out", loginPath };

  const slug = extractCourseSlug(req.headers.get("x-forwarded-host") || req.headers.get("host") || "");
  const course = slug ? await getCourseBySlug(slug) : null;
  if (!course || course.id !== user.courseId || !isCourseUsable(course)) {
    return { ok: false, reason: "signed_out", loginPath };
  }
  if (!isFeatureEnabled(course.settings, PRONUNCIATION_FEATURE)) {
    return { ok: false, reason: "denied", status: 403, message: "এই কোর্সে বাংলা উচ্চারণ চালু নেই।" };
  }

  const role = pronunciationRoleFor(user);
  if (!role) {
    return { ok: false, reason: "denied", status: 403, message: "বাংলা উচ্চারণ খোলার অনুমতি আপনার নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।" };
  }

  const ctx = { courseId: course.id, isSuperAdmin: false };
  let mobile = "";
  if (role === "trainee") {
    const enrolment = await withCourseContext(ctx, (tx) =>
      tx.batchStudent.findFirst({
        where: { courseId: course.id, batchName: user.studentBatchName || "", roll: user.studentRoll || "" },
        select: { phone: true, courseStatus: true },
      }),
    );
    if (!enrolment || isBlockingStatus(enrolment.courseStatus)) {
      return { ok: false, reason: "denied", status: 403, message: "চলমান ব্যাচে ভর্তি থাকলেই এটি খোলা যাবে।" };
    }
    mobile = enrolment.phone;
  } else if (user.teacherId) {
    const teacher = await withCourseContext(ctx, (tx) =>
      tx.teacher.findFirst({ where: { courseId: course.id, teacherId: user.teacherId }, select: { phone: true } }),
    );
    mobile = teacher?.phone || "";
  }

  const token = await signLaunchToken({
    sub: user.id,
    course_id: course.id,
    role,
    name: user.displayName,
    email: user.email,
    mobile: mobile.trim() || undefined,
    batch: role === "trainee" ? user.studentBatchName : undefined,
    roll: role === "trainee" ? user.studentRoll : undefined,
  });
  return { ok: true, location: `${PRONUNCIATION_BASE_PATH}/sso?token=${encodeURIComponent(token)}` };
}
