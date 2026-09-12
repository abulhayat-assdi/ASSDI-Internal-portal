export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { z } from "zod";
import { PORTAL_OWNER_EMAIL } from "@/lib/permissions";

const updateTeacherSchema = z.object({
    teacherDbId: z.string().min(1, "Teacher DB ID is required"),  // Teacher table UUID
    newLoginEmail: z.string().email().optional(),
    isAdmin: z.boolean().optional(),
    teacherId: z.string().optional(),
});

/**
 * POST /api/admin/update-teacher
 * Updates a teacher's login email and/or admin role.
 * Any admin can change the admin flag.
 */
export async function POST(req: NextRequest) {
    try {
        const caller = await getSessionUser(req);
        if (!caller || !isAdmin(caller) || !caller.courseId) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }
        const courseId = caller.courseId;

        const body = await req.json();
        const parsed = updateTeacherSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.message }, { status: 400 });
        }

        const { teacherDbId, newLoginEmail, isAdmin: grantAdmin, teacherId } = parsed.data;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Find teacher record
            const teacher = await tx.teacher.findUnique({ where: { id: teacherDbId, courseId } });
            if (!teacher) {
                return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
            }

            // Block any role/admin changes on the portal owner
            const teacherEmail = teacher.loginEmail || teacher.email;
            if (teacherEmail === PORTAL_OWNER_EMAIL && grantAdmin !== undefined && !grantAdmin) {
                return NextResponse.json({ error: "The portal owner's admin access cannot be revoked." }, { status: 403 });
            }

            // Find corresponding user account
            const user = await tx.user.findFirst({
                where: { courseId, email: teacher.loginEmail || teacher.email },
            });

            // Update teacher record
            await tx.teacher.update({
                where: { id: teacherDbId, courseId },
                data: {
                    ...(newLoginEmail ? { loginEmail: newLoginEmail.toLowerCase().trim() } : {}),
                    ...(grantAdmin !== undefined ? { isAdmin: grantAdmin } : {}),
                    ...(teacherId ? { teacherId } : {}),
                },
            });

            // Update user account if it exists
            if (user) {
                const newRole = grantAdmin !== undefined
                    ? (grantAdmin ? 'admin' : 'teacher')
                    : undefined;

                await tx.user.update({
                    where: { id: user.id, courseId },
                    data: {
                        ...(newLoginEmail ? { email: newLoginEmail.toLowerCase().trim() } : {}),
                        ...(newRole ? { role: newRole as any } : {}),
                        ...(teacherId ? { teacherId } : {}),
                    },
                });
            }

            return NextResponse.json({ success: true, message: "Teacher updated successfully." });
        });
    } catch (error: unknown) {
        console.error("[Update Teacher API] Error:", error);
        const message = error instanceof Error ? error.message : "Failed to update teacher.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
