export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withCourseContext } from "@/lib/db";
import { signJWT } from "@/lib/auth";
import { COOKIES } from "@/lib/constants";
import { consumeImpersonationToken } from "@/lib/impersonation";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, same as normal login

/**
 * GET /api/auth/impersonate?token=... — runs on the COURSE subdomain.
 * Verifies the super-admin-issued token (5-min expiry, single-use, bound to
 * this course + one admin), then sets a normal course-scoped admin session
 * cookie carrying `impersonatedBy` and redirects to /dashboard.
 */
export async function GET(req: NextRequest) {
    const fail = (message: string, status = 401) =>
        NextResponse.json({ error: message }, { status });

    const token = new URL(req.url).searchParams.get("token");
    if (!token) return fail("Missing token.", 400);

    let claims;
    try {
        claims = await consumeImpersonationToken(token);
    } catch {
        return fail("এই লিংকের মেয়াদ শেষ বা ইতিমধ্যে ব্যবহার করা হয়েছে। সুপার-এডমিন প্যানেল থেকে আবার চেষ্টা করুন।");
    }

    // The token must be exchanged on the course it was issued for.
    const hostCourseId = req.headers.get("x-course-id");
    if (!hostCourseId || hostCourseId !== claims.courseId) {
        return fail("Token does not match this course.", 403);
    }

    try {
        const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const target = await tx.user.findFirst({
                where: { id: claims.targetUserId, courseId: claims.courseId, role: "admin", deletedAt: null },
            });
            if (!target) return null;

            await prisma.activeSession.upsert({
                where: { userId: target.id },
                update: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) },
                create: { userId: target.id, expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) },
            });

            await tx.user.update({
                where: { id: target.id },
                data: { lastLoginAt: new Date() },
            }).catch(() => { /* non-critical */ });

            await tx.activityLog.create({
                data: {
                    courseId: claims.courseId,
                    actorUid: claims.issuerId,
                    actorRole: "ADMIN",
                    actionType: "super_admin_impersonation_start",
                    targetType: "user",
                    targetId: target.id,
                    description: `Super-admin ${claims.issuerEmail} logged in as admin ${target.email} (passwordless)`,
                },
            }).catch(() => { /* audit must not block login */ });

            return target;
        });

        if (!result) return fail("Target admin no longer exists.", 403);

        const sessionToken = await signJWT({
            id: result.id,
            email: result.email,
            displayName: result.displayName,
            role: result.role,
            courseId: result.courseId,
            teacherId: result.teacherId ?? undefined,
            impersonatedBy: claims.issuerEmail,
            impersonatedAt: new Date().toISOString(),
        });

        const response = NextResponse.redirect(new URL("/dashboard", req.url));
        response.cookies.set(COOKIES.SESSION, sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: SESSION_MAX_AGE,
        });
        return response;
    } catch (error) {
        console.error("[Impersonate] Error:", error);
        return fail("Internal server error", 500);
    }
}
