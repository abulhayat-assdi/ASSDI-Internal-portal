export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma, withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ disabled: z.boolean() });

/**
 * POST /api/saas/users/[id]/status — disable/enable any account (super_admin only).
 * Disabling sets deletedAt (login + profile lookups already ignore such rows)
 * and revokes the active session so the user is kicked out immediately.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const target = await tx.user.findUnique({ where: { id } });
        if (!target) return { error: "User not found" as const, status: 404 };
        if (target.role === "super_admin") {
            return { error: "Super-admin accounts cannot be disabled here." as const, status: 403 };
        }
        if (parsed.data.disabled) {
            await tx.user.update({ where: { id }, data: { deletedAt: new Date() } });
            await prisma.activeSession.deleteMany({ where: { userId: id } });
        } else {
            await tx.user.update({ where: { id }, data: { deletedAt: null } });
        }
        if (target.courseId) {
            await tx.activityLog.create({
                data: {
                    courseId: target.courseId, actorUid: caller.id, actorRole: "ADMIN",
                    actionType: parsed.data.disabled ? "super_admin_user_disabled" : "super_admin_user_enabled",
                    targetType: "user", targetId: id,
                    description: `Super-admin ${caller.email} ${parsed.data.disabled ? "disabled" : "re-enabled"} ${target.email}`,
                },
            }).catch(() => { /* non-blocking */ });
        }
        return { email: target.email, disabled: parsed.data.disabled };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, ...result });
}
