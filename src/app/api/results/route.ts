import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/results?batchName=...&roll=...&all=true
 * Uses StudentExamBatchRecord for complex multi-exam data.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");
    const roll = searchParams.get("roll");
    const all = searchParams.get("all") === "true";

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        if (all && isTeacherOrAdmin(user)) {
            const records = await tx.studentExamBatchRecord.findMany({ where: { courseId }, orderBy: { batchName: "asc" } });
            return NextResponse.json(records.map(r => ({ id: r.id, batchName: r.batchName, roll: r.roll, name: r.name, ...(r.data as object) })));
        }

        if (batchName && roll) {
            const record = await tx.studentExamBatchRecord.findUnique({
                where: { courseId_batchName_roll: { courseId, batchName, roll } },
            });
            if (!record) return NextResponse.json(null);
            return NextResponse.json({ id: record.id, batchName: record.batchName, roll: record.roll, name: record.name, ...(record.data as object) });
        }

        if (batchName) {
            const records = await tx.studentExamBatchRecord.findMany({ where: { courseId, batchName } });
            return NextResponse.json(records.map(r => ({ id: r.id, batchName: r.batchName, roll: r.roll, name: r.name, ...(r.data as object) })));
        }

        return NextResponse.json([]);
    });
}

/**
 * POST /api/results — save or update a single result
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { batchName, roll, name, fixedSubjectLabels, customColumns, examRecords, presentationColumns, presentationRecords, marks, remarks } = body;

        if (!batchName || !roll) {
            return NextResponse.json({ error: "batchName and roll required" }, { status: 400 });
        }

        const data = { fixedSubjectLabels, customColumns, examRecords, presentationColumns, presentationRecords, marks, remarks };

        const record = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.studentExamBatchRecord.upsert({
                where: { courseId_batchName_roll: { courseId, batchName, roll } },
                update: { data, name: name || "" },
                create: { courseId, batchName, roll, name: name || "", data },
            })
        );

        return NextResponse.json({ id: record.id, success: true });
    } catch (error) {
        console.error("[Results POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
