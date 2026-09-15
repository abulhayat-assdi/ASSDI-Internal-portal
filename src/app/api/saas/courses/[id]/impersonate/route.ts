export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { mintImpersonationToken } from "@/lib/impersonation";
import { z } from "zod";

const bodySchema = z.object({
    /** Which admin to log in as. Defaults to the earliest-created admin. */
    userId: z.string().optional(),
});

/**
 * POST /api/saas/courses/[id]/impersonate — super_admin only (admin host).
 * Mints a short-lived, single-use token that the browser exchanges on the
 * course subdomain (GET /api/auth/impersonate?token=...) for a real
 * course-scoped admin session — no email/password needed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: courseId } = await params;

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const course = await tx.course.findUnique({ where: { id: courseId } });
        if (!course) return { error: "Course not found" as const, status: 404 };

        let target;
        if (parsed.data.userId) {
            target = await tx.user.findFirst({
                where: { id: parsed.data.userId, courseId, role: "admin", deletedAt: null },
            });
            if (!target) return { error: "Admin not found in this course." as const, status: 404 };
        } else {
            target = await tx.user.findFirst({
                where: { courseId, role: "admin", deletedAt: null },
                orderBy: { createdAt: "asc" },
            });
            if (!target) {
                return { error: "এই কোর্সে কোনো অ্যাডমিন নেই। আগে একজন অ্যাডমিন যোগ করুন।" as const, status: 404 };
            }
        }

        const token = await mintImpersonationToken({
            courseId,
            targetUserId: target.id,
            issuerId: caller.id,
            issuerEmail: caller.email,
        });

        // Audit: who impersonated whom. ActorRole has no SUPER_ADMIN variant,
        // so we log as ADMIN with the super-admin's email in the description.
        await tx.activityLog.create({
            data: {
                courseId,
                actorUid: caller.id,
                actorRole: "ADMIN",
                actionType: "super_admin_impersonation_token",
                targetType: "user",
                targetId: target.id,
                description: `Super-admin ${caller.email} issued login-as-admin token for ${target.email}`,
            },
        }).catch(() => { /* audit must not block the flow */ });

        return { token, slug: course.slug, targetEmail: target.email, targetName: target.displayName };
    });

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
}
