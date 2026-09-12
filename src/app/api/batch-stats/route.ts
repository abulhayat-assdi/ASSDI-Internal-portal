import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/batch-stats — aggregated stats per batch */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const stats = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const batches = await tx.batch.findMany({ where: { courseId }, orderBy: { name: "asc" } });

        return Promise.all(
            batches.map(async (batch) => {
                const [total, running, completed, expelled] = await Promise.all([
                    tx.batchStudent.count({ where: { courseId, batchName: batch.name } }),
                    tx.batchStudent.count({ where: { courseId, batchName: batch.name, courseStatus: "Running" } }),
                    tx.batchStudent.count({ where: { courseId, batchName: batch.name, courseStatus: "Completed" } }),
                    tx.batchStudent.count({ where: { courseId, batchName: batch.name, courseStatus: "Expelled" } }),
                ]);

                return {
                    id: batch.id,
                    name: batch.name,
                    status: batch.status,
                    totalStudents: total,
                    runningStudents: running,
                    completedStudents: completed,
                    expelledStudents: expelled,
                };
            })
        );
    });

    return NextResponse.json(stats);
}
