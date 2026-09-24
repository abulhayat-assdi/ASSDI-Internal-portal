import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/homework?teacherName=...&studentUid=...&batchName=...&assignmentId=...&all=true */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const teacherName = searchParams.get("teacherName");
    const studentUid  = searchParams.get("studentUid");
    const batchName   = searchParams.get("batchName");
    const assignmentId = searchParams.get("assignmentId");
    const all         = searchParams.get("all") === "true";

    const where: Record<string, unknown> = { courseId, deletedAt: null };
    if (teacherName) where.teacherName      = teacherName;
    if (studentUid)  where.studentUid       = studentUid;
    if (batchName)   where.studentBatchName = batchName;

    if (all && !isTeacherOrAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // Assignment-scoped view: allowed for the owner, a teacher the folder
        // is shared with (view-only), or an admin. Used for shared folders,
        // whose submissions carry the owner's teacherName.
        if (assignmentId) {
            if (!isTeacherOrAdmin(user)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
                const assignment = await tx.homeworkAssignment.findUnique({
                    where: { id: assignmentId, courseId },
                    select: { id: true, teacherUid: true },
                });
                if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
                const isOwner = assignment.teacherUid === user.id;
                const isAdminUser = user.role === "admin" || user.role === "super_admin";
                const isShared = !isOwner && !isAdminUser
                    ? (await tx.homeworkAssignmentShare.count({
                        where: { assignmentId, courseId, sharedWithTeacherUid: user.id },
                    })) > 0
                    : true;
                if (!isOwner && !isAdminUser && !isShared) {
                    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
                }
                const submissions = await tx.homeworkSubmission.findMany({
                    where: { courseId, assignmentId, deletedAt: null },
                    orderBy: { submittedAt: "desc" },
                });
                return NextResponse.json(submissions);
            });
        }

        const submissions = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkSubmission.findMany({
                where,
                orderBy: { submittedAt: "desc" },
            })
        );
        return NextResponse.json(submissions);
    } catch (error) {
        console.error("[Homework GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** POST /api/homework — submit homework */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const {
        studentUid, studentName, studentRoll, studentBatchName,
        teacherName, subject, files, fileUrl, storagePath, fileName,
        textContent, submissionDate, assignmentId,
    } = body;

    const submissionData = {
        courseId,
        studentUid:       studentUid       || user.id,
        studentName:      studentName      || user.displayName,
        studentRoll:      studentRoll      || user.studentRoll  || "",
        studentBatchName: studentBatchName || user.studentBatchName || "",
        teacherName:      teacherName      || "",
        subject:          subject          || "",
        files:            files            ?? null,
        fileUrl:          fileUrl          ?? null,
        storagePath:      storagePath      ?? null,
        fileName:         fileName         ?? null,
        textContent:      textContent      ?? null,
        submissionDate:   submissionDate   || new Date().toISOString().split("T")[0],
        assignmentId:     assignmentId     ?? null,
    };

    try {
        const submission = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.homeworkSubmission.create({ data: submissionData })
        );
        return NextResponse.json({ id: submission.id, success: true }, { status: 201 });
    } catch (error) {
        console.error("[Homework POST]", error);
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/** DELETE /api/homework — soft delete submission */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { id } = body;
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const submission = await tx.homeworkSubmission.findUnique({ where: { id, courseId } });
            if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

            if (!isTeacherOrAdmin(user) && submission.studentUid !== user.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            await tx.homeworkSubmission.update({
                where: { id, courseId },
                data: { deletedAt: new Date() },
            });

            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("[Homework DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
