import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { purgeBatchHomework, deleteHomeworkFiles } from "@/lib/homeworkPurge";
import { logHomeworkActivity } from "@/lib/homeworkLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/homework/cleanup — permanently delete the homework of completed batches.
 *
 * Marking a batch Completed already does this on the spot; this sweep catches
 * batches that were completed before that existed. Which batches are complete
 * is decided here from the Batch table, never taken from the request body.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { batches } = body as { batches: { batchName: string; completedAt: Date }[] };

        if (!Array.isArray(batches) || batches.length === 0) {
            return NextResponse.json({ error: "batches array required" }, { status: 400 });
        }

        const requested = batches.map(b => b.batchName);

        const { deleted, filePaths } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const completed = await tx.batch.findMany({
                where: { courseId, name: { in: requested }, status: "archived" },
                select: { id: true, name: true },
            });

            let deleted = 0;
            const filePaths: string[] = [];
            for (const batch of completed) {
                const purge = await purgeBatchHomework(tx, courseId, batch.name);
                if (purge.submissions === 0 && purge.assignments === 0) continue;
                deleted += purge.submissions;
                filePaths.push(...purge.filePaths);
                await logHomeworkActivity(tx, user, {
                    action: "HOMEWORK_BATCH_PURGED",
                    targetType: "batch",
                    targetId: batch.id,
                    description: `Cleanup of completed batch ${batch.name} — deleted ${purge.assignments} homework folder(s) and ${purge.submissions} submission(s)`,
                });
            }
            return { deleted, filePaths };
        });

        await deleteHomeworkFiles(filePaths);

        return NextResponse.json({ deleted });
    } catch (error) {
        console.error("[Homework Cleanup]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
