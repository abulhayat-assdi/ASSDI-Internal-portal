import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";
import { logHomeworkActivity } from "@/lib/homeworkLog";
import { canGradeAssignment, submissionAccess } from "@/lib/homeworkAccess";
import { formatMarks, isGraded, MAX_FEEDBACK_LENGTH, parseMarks } from "@/lib/homeworkGrading";
import { notifyStudentOfHomeworkReturned } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReturnedNotice = Parameters<typeof notifyStudentOfHomeworkReturned>[0];

/**
 * PATCH /api/homework/grade — save marks/feedback on one submission.
 * Body: { submissionId, marks?: number|null, feedback?: string, action?: "save" | "return" | "unreturn" }
 * Folder owner or admin only; teachers a folder is shared with stay view-only.
 */
export async function PATCH(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !isTeacherOrAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    const { submissionId } = body ?? {};
    const action: "save" | "return" | "unreturn" = body?.action === "return" || body?.action === "unreturn" ? body.action : "save";
    if (!submissionId || typeof submissionId !== "string") return NextResponse.json({ error: "submissionId required" }, { status: 400 });

    try {
        const notices: ReturnedNotice[] = [];
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const sub = await tx.homeworkSubmission.findFirst({ where: { id: submissionId, courseId, deletedAt: null } });
            if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
            const access = await submissionAccess(tx, user, sub);
            if (!access.canGrade) {
                return NextResponse.json({ error: "শুধু ফোল্ডারের মালিক বা অ্যাডমিন মার্কস দিতে পারবেন।" }, { status: 403 });
            }
            const marksEnabled = !!access.assignment?.marksEnabled && !!access.assignment.totalMarks;

            const data: Record<string, unknown> = {};
            if ("marks" in body) {
                if (!marksEnabled) {
                    if (body.marks !== null && body.marks !== "" && body.marks !== undefined) {
                        return NextResponse.json({ error: "এই অ্যাসাইনমেন্টে মার্কস চালু নেই।" }, { status: 400 });
                    }
                } else {
                    const parsed = parseMarks(body.marks, access.assignment!.totalMarks!);
                    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
                    data.marks = parsed.value;
                }
            }
            if ("feedback" in body) {
                const fb = typeof body.feedback === "string" ? body.feedback.trim() : "";
                if (fb.length > MAX_FEEDBACK_LENGTH) {
                    return NextResponse.json({ error: `ফিডব্যাক সর্বোচ্চ ${MAX_FEEDBACK_LENGTH} অক্ষর হতে পারে।` }, { status: 400 });
                }
                data.feedback = fb || null;
            }

            const gradeChanged =
                ("marks" in data && data.marks !== sub.marks) || ("feedback" in data && data.feedback !== sub.feedback);
            if (gradeChanged) {
                data.gradedAt = new Date();
                data.gradedByUid = user.id;
                data.gradedByName = user.displayName;
            }

            const next = { ...sub, ...data } as typeof sub;
            if (action === "return") {
                if (!isGraded(next, marksEnabled)) {
                    return NextResponse.json(
                        { error: marksEnabled ? "Return করার আগে মার্কস দিন।" : "Return করার আগে ফিডব্যাক লিখুন।" },
                        { status: 400 }
                    );
                }
                data.returnedAt = new Date();
            } else if (action === "unreturn") {
                data.returnedAt = null;
            }

            const updated = Object.keys(data).length
                ? await tx.homeworkSubmission.update({ where: { id: sub.id, courseId }, data })
                : sub;

            if (gradeChanged || action !== "save") {
                const marksText = marksEnabled && updated.marks !== null
                    ? ` ${formatMarks(updated.marks)}/${formatMarks(access.assignment!.totalMarks)}`
                    : "";
                await logHomeworkActivity(tx, user, {
                    action: action === "return" ? "HOMEWORK_SUBMISSION_RETURNED" : "HOMEWORK_SUBMISSION_GRADED",
                    targetType: "homework_submission",
                    targetId: sub.id,
                    description: action === "return"
                        ? `${user.displayName} returned ${sub.studentName}'s (roll ${sub.studentRoll}) "${sub.subject}"${marksText}`
                        : action === "unreturn"
                            ? `${user.displayName} took back the returned grade of ${sub.studentName}'s (roll ${sub.studentRoll}) "${sub.subject}"`
                            : `${user.displayName} graded ${sub.studentName}'s (roll ${sub.studentRoll}) "${sub.subject}"${marksText}`,
                });
            }

            // Mail only on the first return, not on every later edit.
            if (action === "return" && !sub.returnedAt) {
                notices.push({
                    courseId,
                    batchName: sub.studentBatchName,
                    roll: sub.studentRoll,
                    studentName: sub.studentName,
                    homeworkTitle: sub.subject,
                    marks: marksEnabled ? updated.marks : null,
                    totalMarks: marksEnabled ? access.assignment!.totalMarks : null,
                });
            }
            return NextResponse.json(updated);
        });
        notices.forEach((n) => notifyStudentOfHomeworkReturned(n));
        return result;
    } catch (error) {
        console.error("[Homework grade PATCH]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/homework/grade — { assignmentId, action: "return_all" }
 * Returns every graded, not-yet-returned submission in the folder.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !isTeacherOrAdmin(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    if (body?.action !== "return_all" || typeof body.assignmentId !== "string") {
        return NextResponse.json({ error: "assignmentId and action=return_all required" }, { status: 400 });
    }

    try {
        const notices: ReturnedNotice[] = [];
        const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const assignment = await canGradeAssignment(tx, user, body.assignmentId);
            if (!assignment) return NextResponse.json({ error: "শুধু ফোল্ডারের মালিক বা অ্যাডমিন Return করতে পারবেন।" }, { status: 403 });
            const marksEnabled = assignment.marksEnabled && !!assignment.totalMarks;
            const pending = await tx.homeworkSubmission.findMany({
                where: { courseId, assignmentId: assignment.id, deletedAt: null, returnedAt: null },
            });
            const ready = pending.filter((s) => isGraded(s, marksEnabled));
            if (ready.length === 0) return NextResponse.json({ returned: 0, ids: [], returnedAt: null });
            const now = new Date();
            await tx.homeworkSubmission.updateMany({
                where: { courseId, id: { in: ready.map((s) => s.id) } },
                data: { returnedAt: now },
            });
            await logHomeworkActivity(tx, user, {
                action: "HOMEWORK_SUBMISSION_RETURNED",
                targetType: "homework_assignment",
                targetId: assignment.id,
                description: `${user.displayName} returned ${ready.length} graded submission${ready.length === 1 ? "" : "s"} in "${assignment.title}"`,
            });
            for (const s of ready) {
                notices.push({
                    courseId,
                    batchName: s.studentBatchName,
                    roll: s.studentRoll,
                    studentName: s.studentName,
                    homeworkTitle: s.subject,
                    marks: marksEnabled ? s.marks : null,
                    totalMarks: marksEnabled ? assignment.totalMarks : null,
                });
            }
            return NextResponse.json({ returned: ready.length, ids: ready.map((s) => s.id), returnedAt: now.toISOString() });
        });
        notices.forEach((n) => notifyStudentOfHomeworkReturned(n));
        return result;
    } catch (error) {
        console.error("[Homework grade POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
