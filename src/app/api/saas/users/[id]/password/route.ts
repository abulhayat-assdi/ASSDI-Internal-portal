export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({ newPassword: z.string().min(6) });

/** POST /api/saas/users/[id]/password — set any user's password (super_admin only). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const target = await tx.user.findUnique({ where: { id } });
        if (!target) return { error: "User not found" as const, status: 404 };
        if (target.role === "super_admin" && target.id !== caller.id) {
            return { error: "Cannot change another super-admin's password." as const, status: 403 };
        }
        await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
        if (target.courseId) {
            await tx.activityLog.create({
                data: {
                    courseId: target.courseId, actorUid: caller.id, actorRole: "ADMIN",
                    actionType: "super_admin_password_reset", targetType: "user", targetId: id,
                    description: `Super-admin ${caller.email} reset password for ${target.email}`,
                },
            }).catch(() => { /* non-blocking */ });
        }
        return { email: target.email };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, email: result.email });
}
