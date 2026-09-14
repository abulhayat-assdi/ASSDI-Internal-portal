import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface ResourceTeacher {
    teacherUid: string;
    teacherName: string;
    designation: string;
    profileImageUrl: string | null;
    order: number;
}

/**
 * GET /api/resources/teachers
 * Returns all teachers in this course joined with their User ID (for resource
 * library linking) by matching teachers.loginEmail to users.email.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const teachers = await tx.teacher.findMany({
            where: { courseId, loginEmail: { not: "" } },
            orderBy: { order: "asc" },
            select: { name: true, designation: true, profileImageUrl: true, order: true, loginEmail: true },
        });
        if (teachers.length === 0) return [];

        const users = await tx.user.findMany({
            where: { courseId },
            select: { id: true, email: true },
        });
        const userIdByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u.id]));

        const out: ResourceTeacher[] = [];
        for (const t of teachers) {
            const teacherUid = userIdByEmail.get(t.loginEmail.trim().toLowerCase());
            if (!teacherUid) continue;
            out.push({
                teacherUid,
                teacherName: t.name,
                designation: t.designation,
                profileImageUrl: t.profileImageUrl,
                order: t.order,
            });
        }
        return out;
    });

    return NextResponse.json(result);
}
