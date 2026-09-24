export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma, withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
    userId: z.string().min(1),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

/** POST /api/admin/set-user-password — directly set any user's password (admin only) */
export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues.map(e => e.message).join(", ") },
                { status: 400 }
            );
        }

        const { userId, newPassword } = parsed.data;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId, courseId, deletedAt: null },
            });

            if (!user) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            const passwordHash = await bcrypt.hash(newPassword, 12);

            await tx.user.update({
                where: { id: userId, courseId },
                data: { passwordHash },
            });

            // Kick the target out of any session running on the old password.
            await prisma.activeSession.deleteMany({ where: { userId } });

            console.log(`[Admin] Password reset for user ${user.email} by admin ${caller.email}`);

            return NextResponse.json({ success: true, message: `Password updated for ${user.email}` });
        });
    } catch (error) {
        console.error("[Admin Set Password]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
