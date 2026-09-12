import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/results/batch?batchName=...
 * Returns all exam records for a batch.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");
    if (!batchName) return NextResponse.json({ error: "batchName required" }, { status: 400 });

    const records = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.studentExamBatchRecord.findMany({
            where: { courseId, batchName },
            orderBy: { roll: "asc" },
        })
    );

    return NextResponse.json(records.map(r => ({
        id: r.id,
        batchName: r.batchName,
        roll: r.roll,
        name: r.name,
        ...(r.data as object),
    })));
}

/**
 * POST /api/results/batch — upsert all results for a batch
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { batchName, results } = body;

        if (!batchName || !Array.isArray(results)) {
            return NextResponse.json({ error: "batchName and results array required" }, { status: 400 });
        }

        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            Promise.all(
                results.map((r: any) => {
                    const data = {
                        fixedSubjectLabels: r.fixedSubjectLabels,
                        customColumns: r.customColumns,
                        examRecords: r.examRecords,
                        presentationColumns: r.presentationColumns,
                        presentationRecords: r.presentationRecords,
                        marks: r.marks,
                        remarks: r.remarks,
                    };
                    return tx.studentExamBatchRecord.upsert({
                        where: { courseId_batchName_roll: { courseId, batchName, roll: r.roll } },
                        update: { name: r.name || "", data },
                        create: { courseId, batchName, roll: r.roll, name: r.name || "", data },
                    });
                })
            )
        );

        return NextResponse.json({ success: true, count: results.length });
    } catch (error) {
        console.error("[Results Batch POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
