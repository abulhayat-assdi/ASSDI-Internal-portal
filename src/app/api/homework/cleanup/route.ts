import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/homework/cleanup — soft-delete all submissions for completed batches */
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

        const batchNames = batches.map(b => b.batchName);

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkSubmission.updateMany({
                where: {
                    courseId,
                    studentBatchName: { in: batchNames },
                    deletedAt: null,
                },
                data: { deletedAt: new Date() },
            })
        );

        return NextResponse.json({ deleted: result.count });
    } catch (error) {
        console.error("[Homework Cleanup]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
